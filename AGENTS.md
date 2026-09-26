# [dot]agents

This repo contains centralized configuration for the user's AI coding agents. Supported coding agent CLI tools:

- **pi (`~/.pi/agent`) <- currently chosen and is being worked on actively**
- oh my pi (`~/.omp/agent`)
- codex (`~/.codex/`)

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

> **NOTE**: This means that if there is any instruction/prompt/skill that talks about
>
> - `~/.pi/agent/extensions` or
> - `~/.pi/agent/<some configuration file, especially .json or .yml>`,
>
> you should consider the equivalent of that file in this repo instead
> and also consider moving the file here and creating a symlink to it instead

## Folder structure

```
root:

# non core directories
- .pi-and-omp-source-code       # source code of pi and oh-my-pi, cloned from github
- .other-pi-configs             # pi config repos from other users
- .pi-extension-playground      # cloned pi extension repos to look at their source code

# core directories to configure pi and other agents
- extensions                    # local, custom user level pi extensions
- tests                         # unit tests for the typescript modules in extensions
- agents                        # custom subagents
- skills                        # custom skills
- output-styles                 # output style instructions
- AGENTS.md                     # project specific instructions
- pi.settings.json              # settings.json in ~/.pi/agent
- omp.config.yml                # config.yml in ~/.omp/agent
- pi-extensions.txt             # requirements.txt equivalent but for pi extensions

# repo housekeeping and dotfiles management
- scripts                       # one off python/bash scripts
- AGENTS.md.j2                  # jinja template for user level agents.md for supported cli
- config.json                   # dotfiles config + agents.md template management
- docs/                         # repo level docs
```
