import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isToolCallEventType,
  VERSION,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const hook = `#!/bin/sh
set -eu

git \\
  -c trailer.co-authored-by.ifExists=addIfDifferent \\
  -c trailer.generated-by.ifExists=replace \\
  interpret-trailers --in-place \\
  --trailer "$PI_COMMIT_CO_AUTHOR" \\
  --trailer "$PI_COMMIT_GENERATED_BY" "$1"

# remove only the temporary config entry before finding the repository's own hook.
index="$PI_COMMIT_CONFIG_INDEX"
unset "GIT_CONFIG_KEY_$index" "GIT_CONFIG_VALUE_$index"
export GIT_CONFIG_COUNT="$index"

original_hooks_path="$(git config --get core.hooksPath || true)"
if [ -n "$original_hooks_path" ]; then
  case "$original_hooks_path" in
    /*) original_hook="$original_hooks_path/prepare-commit-msg" ;;
    *) original_hook="$(git rev-parse --show-toplevel)/$original_hooks_path/prepare-commit-msg" ;;
  esac
else
  original_hook="$(git rev-parse --git-path hooks/prepare-commit-msg)"
fi

if [ -x "$original_hook" ] && [ "$original_hook" != "$0" ]; then
  "$original_hook" "$@"
fi
`;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function trailerValue(value: string): string {
  return (
    value
      .replaceAll("\0", " ")
      .replace(/[<>\r\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "unknown"
  );
}

/**
 * Attribute commits created through Pi's bash tool without changing repository configuration.
 *
 * A process-local Git configuration installs a temporary prepare-commit-msg hook, so
 * nested shells, git -C, commit message files, and amended commits work too. Leave
 * user-entered shell commands and commits from other processes alone.
 *
 * Parameters
 * ----------
 * pi : ExtensionAPI
 *     Pi runtime used to intercept agent bash calls and clean up on shutdown.
 */
export default function piGitCommitAttribution(pi: ExtensionAPI): void {
  let hooksDirectory: string | undefined;

  pi.on("tool_call", (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    if (!hooksDirectory) {
      hooksDirectory = mkdtempSync(join(tmpdir(), "pi-commit-hooks-"));
      const hookPath = join(hooksDirectory, "prepare-commit-msg");
      writeFileSync(hookPath, hook);
      chmodSync(hookPath, 0o755);
    }

    const model = ctx.model;
    const name = trailerValue(
      model ? model.name || `${model.provider}/${model.id}` : "unknown",
    );
    const version = trailerValue(VERSION);
    const path = hooksDirectory.replace(/[\\"$`]/g, "\\$&");

    // append a config slot rather than overwriting the caller's existing git config.
    event.input.command = `__pi_commit_index="\${GIT_CONFIG_COUNT:-0}"
export PI_COMMIT_CONFIG_INDEX="$__pi_commit_index"
export PI_COMMIT_CO_AUTHOR=${shellQuote(`Co-Authored-By: ${name} <noreply@pi.dev>`)}
export PI_COMMIT_GENERATED_BY=${shellQuote(`Generated-By: pi ${version} (https://pi.dev)`)}
export "GIT_CONFIG_KEY_\${__pi_commit_index}=core.hooksPath"
export "GIT_CONFIG_VALUE_\${__pi_commit_index}=${path}"
export GIT_CONFIG_COUNT="$((__pi_commit_index + 1))"
unset __pi_commit_index
${event.input.command}`;
  });

  pi.on("session_shutdown", () => {
    if (hooksDirectory)
      rmSync(hooksDirectory, { recursive: true, force: true });
    hooksDirectory = undefined;
  });
}
