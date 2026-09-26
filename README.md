# .agents

This repo contains my personal agents configuration dir. General configuration for this repo will be at [docs](./docs/)

This repo contains centralized configuration for the user's AI coding agents. Supported coding agent CLI tools:

- **pi (`~/.pi/agent`) <- currently chosen and is being worked on actively**
- oh my pi (`~/.omp/agent`)
- codex (`~/.codex/`)

## Getting started

1. Clone this repo and `cd` into it. Install Python 3, uv, Node.js 24+ (with npm), Bun, and the coding agent CLI you use (Pi, Oh My Pi, or Codex).
2. Set up the project environments from the repo root:
   ```bash
   uv venv .venv
   uv pip install -r requirements.txt
   npm install --no-package-lock
   ```
   The npm dependencies provide TypeScript/Node types and Pi declarations for VS Code. Run `npm test` for extension tests and `npx tsc --noEmit` to type-check.
3. Generate the user-level `AGENTS.md` for your agent with `.venv/bin/python scripts/agentsdotmd.py --profile pi` (replace `pi` with `oh-my-pi` or `codex`; omit `--profile` to generate all three).
4. If using Pi, install packages from `pi-extensions.txt` with `.venv/bin/python scripts/install-pi-extensions.py --path pi-extensions.txt`.
5. Start your coding agent.

## Centralized configuration philosophy

This repo contains centralised configuration at the following levels

1. general coding agent capabilities:
    - skills, mcp, subagents, AGENTS.md, memory.
    - this is common to all and share a common spec
    - should have a centralized source of truth in this repo
2. cli specific configuration
    - configuration specific to a cli (pi extensions, pi configuration and settings)

This means that certain configuration files and directories which should have been in other directories, are rather being developed here to keep that centralization. This includes the following:

- `extensions` (`~/.pi/agent/extensions` is symlinked to this): source of truth for all custom pi extensions
- `pi.settings.json` (`~/.pi/agent/settings.json` is symlinked to this): source of truth for pi settings
- `AGENTS.md.j2` (jinja template materialised and deployed at cli specific config dirs): source of truth template for user level AGENTS.md

## Installed pi extensions

This repo contains my `pi` extensions. Custom extensions are at [`extensions`](./extensions/)

| name                        | purpose                                                | url / link                                                                                                                                   |
| --------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pi-better-openai`          | add openai web search and codex specific features      | [pi-better-openai](https://github.com/monotykamary/pi-better-openai)                                                                        |
| `pi-git-commit-attribution` | programmatically add a git attribution line at the end | [pi-git-commit-attribution.ts](extensions/pi-git-commit-attribution.ts), inspired from [pi-must-win](https://github.com/osolmaz/pi-must-win) |
