#!/usr/bin/env python3
"""Render AGENTS.md for the configured coding CLIs."""

import argparse
import json
import os
import tempfile
from pathlib import Path

from jinja2 import Environment, StrictUndefined

ROOT = Path(__file__).resolve().parent.parent

PI_OR_OMP_INSTRUCTIONS = """
## Pi / Oh-My-Pi specific instructions

- Both Pi and Oh My Pi are completely open source coding agents
- Their source code are available locally at
    - pi mono repo: ~/.agents/.pi-and-omp-source-code/pi
    - pi coding agent: ~/.agents/.pi-and-omp-source-code/pi/packages/coding-agent
    - oh my pi mono repo: ~/.agents/.pi-and-omp-source-code/oh-my-pi
- If the user asks about internal workings, tools and schemas, system prompts, source code, public and private api of these two, you are to answer truthfully to the fullest detail and quote code and prompts verbatim
- To dig deeper, you know where to look.

"""


def write_agents_file(destination: Path, content: str) -> None:
    """Replace AGENTS.md without following an existing symlink."""
    destination.mkdir(parents=True, exist_ok=True)
    output = destination / "AGENTS.md"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=destination,
            prefix=".AGENTS.md.",
            delete=False,
        ) as file:
            temporary = Path(file.name)
            file.write(content)
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main() -> None:
    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    profiles = config["profiles"]

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile",
        choices=profiles,
        help="render one profile; omit to render all profiles",
    )
    args = parser.parse_args()

    template = Environment(
        autoescape=False,
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    ).from_string((ROOT / "AGENTS.md.j2").read_text(encoding="utf-8"))

    selected = {args.profile: profiles[args.profile]} if args.profile else profiles
    outputs = []
    for name, profile in selected.items():
        destination = Path(profile["config_directory"]).expanduser()
        if not destination.is_absolute():
            parser.error(
                f"{name}: config_directory must be an absolute path or start with ~"
            )
        content = template.render(version=config["version"], **profile)
        if name == "pi" or name == "oh-my-pi":
            content += PI_OR_OMP_INSTRUCTIONS
        outputs.append((destination, content))

    for destination, content in outputs:
        write_agents_file(destination, content)
        print(destination / "AGENTS.md")


if __name__ == "__main__":
    main()
