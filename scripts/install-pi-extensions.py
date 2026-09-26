"""
Installation script for pi extensions. Kind of like requirements.txt, but for pi.
Provide path to a file that contains one pi extension url per line in the format of `source:repo`.

The script will call `pi install <entry>` for the entry in each line.

Examples:
---
```text
git:github.com/username/repo
npm:@username/repo
npm:repo
```
"""

import argparse
import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger("pi-extension-installer")


def main() -> int:
    """Validate the complete list before installing packages in file order.

    Returns
    -------
    int
        Zero on success, or the failing install's exit code. Invalid input
        exits through argparse without installing any packages.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--path",
        "-p",
        required=True,
        type=Path,
        help="Path to the text file containing Pi package sources.",
    )
    args = parser.parse_args()

    try:
        lines = args.path.expanduser().read_text(encoding="utf-8").splitlines()
    except OSError as error:
        parser.error(f"cannot read {args.path}: {error}")

    sources = []
    for number, line in enumerate(lines, start=1):
        source = line.strip()
        if not source or source.startswith("#"):
            continue
        kind, separator, repo = source.partition(":")
        if (
            kind not in {"npm", "git"}
            or not separator
            or not repo
            or any(character.isspace() for character in source)
        ):
            msg = f"{args.path}:{number}: invalid package source: {source!r}"
            logger.error(msg)
            parser.error(msg)
        sources.append(source)

    for source in sources:
        logger.info(f"Installing {source = }")
        try:
            subprocess.run(["pi", "install", source], check=True)
        except FileNotFoundError:
            logger.error("pi executable not found on PATH")
            return 1
        except subprocess.CalledProcessError as error:
            logger.error(
                f"Failed to install {source = } (exit code {error.returncode})"
            )
            return error.returncode
    logger.info(f"Installed {len(sources)} Pi packages")
    return 0


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
        stream=sys.stdout,
    )
    raise SystemExit(main())
