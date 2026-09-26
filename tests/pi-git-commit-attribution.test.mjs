import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { VERSION } from "@earendil-works/pi-coding-agent";
import attribution from "../extensions/pi-git-commit-attribution.ts";

const model = { name: "Test Model", provider: "test", id: "model" };
// isolate repositories from any git config injected by the invoking agent.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.startsWith("GIT_CONFIG_") && !key.startsWith("PI_COMMIT_"),
  ),
);

/**
 * Run each scenario in an isolated Git repository with real commit hooks.
 *
 * Parameters
 * ----------
 * check : (repo: object) => void
 *     Exercise the extension and assert the resulting Git history.
 */
function withRepo(check) {
  const dir = mkdtempSync(join(tmpdir(), "pi-attribution-' "));
  const handlers = new Map();
  attribution({ on: (event, handler) => handlers.set(event, handler) });
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, env: cleanEnv, encoding: "utf8" }).trim();
  const bash = (command, selectedModel = model, env = cleanEnv) => {
    const event = { toolName: "bash", input: { command } };
    handlers.get("tool_call")(event, { model: selectedModel });
    const result = spawnSync("bash", ["-c", event.input.command], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
    return { ...result, command: event.input.command };
  };
  const commit = (name, command = `git commit -qm ${name}`) => {
    writeFileSync(join(dir, name), name);
    git("add", name);
    const result = bash(command);
    assert.equal(result.status, 0, result.stderr);
    return git("log", "-1", "--format=%B");
  };

  try {
    git("init", "-q");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.org");
    check({ dir, git, bash, commit, handlers });
  } finally {
    handlers.get("session_shutdown")();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("adds only the requested trailers, without persisting Git configuration", () => {
  withRepo(({ git, commit }) => {
    const message = commit("first");
    assert.match(message, /Co-Authored-By: Test Model <noreply@pi\.dev>/);
    assert.ok(message.includes(`Generated-By: pi ${VERSION} (https://pi.dev)`));
    assert.doesNotMatch(git("config", "--local", "--list"), /core\.hookspath/i);
  });
});

test("handles nested shells, message files, git -C, amend, and a changed model", () => {
  withRepo(({ dir, git, bash, commit }) => {
    writeFileSync(join(dir, "message.txt"), "from file\n");
    const message = commit("first", "sh -c 'git commit -q -F message.txt'");
    assert.match(message, /from file/);
    assert.match(message, /Generated-By:/);

    const amended = bash("git -C . commit --amend --no-edit -q", {
      name: "Other Model",
      provider: "test",
      id: "other",
    });
    assert.equal(amended.status, 0, amended.stderr);
    const updated = git("log", "-1", "--format=%B");
    assert.match(updated, /Co-Authored-By: Other Model <noreply@pi\.dev>/);
    assert.equal((updated.match(/Generated-By:/g) ?? []).length, 1);
  });
});

test("chains existing hooks and propagates their failures", () => {
  withRepo(({ dir, git, bash, commit }) => {
    const hooks = join(dir, "custom-hooks");
    mkdirSync(hooks);
    const hook = join(hooks, "prepare-commit-msg");
    const marker = join(dir, "hook-called");
    writeFileSync(hook, "#!/bin/sh\nprintf called > hook-called\n");
    chmodSync(hook, 0o755);
    git("config", "core.hooksPath", hooks);
    assert.match(commit("first"), /Generated-By:/);
    assert.equal(readFileSync(marker, "utf8"), "called");

    writeFileSync(hook, "#!/bin/sh\nexit 1\n");
    writeFileSync(join(dir, "second"), "second");
    git("add", "second");
    assert.notEqual(bash("git commit -qm second").status, 0);
    assert.match(git("log", "-1", "--format=%s"), /first/);
  });
});

test("leaves external commits and non-bash tool calls alone", () => {
  withRepo(({ dir, git, bash, handlers }) => {
    const event = { toolName: "read", input: { path: "file" } };
    handlers.get("tool_call")(event, { model });
    assert.deepEqual(event.input, { path: "file" });

    writeFileSync(join(dir, "external"), "external");
    git("add", "external");
    git("commit", "-qm", "external");
    assert.doesNotMatch(git("log", "-1", "--format=%B"), /Generated-By:/);
    assert.equal(bash("git status --short").status, 0);
  });
});

test("sanitizes trailer values and respects preexisting Git config slots", () => {
  withRepo(({ dir, git, bash }) => {
    const env = {
      ...cleanEnv,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "commit.cleanup",
      GIT_CONFIG_VALUE_0: "strip",
    };
    writeFileSync(join(dir, "first"), "first");
    git("add", "first");
    const result = bash(
      "git commit -qm first",
      {
        name: "Unsafe <Model>\nInjected: yes",
        provider: "test",
        id: "model",
      },
      env,
    );
    assert.equal(result.status, 0, result.stderr);
    const message = git("log", "-1", "--format=%B");
    assert.match(
      message,
      /Co-Authored-By: Unsafe Model Injected: yes <noreply@pi\.dev>/,
    );
    assert.doesNotMatch(message, /\nInjected: yes/);
  });
});

test("removes the temporary hook directory at session shutdown", () => {
  withRepo(({ bash, handlers }) => {
    const result = bash('printf "%s" "$GIT_CONFIG_VALUE_0"');
    assert.equal(result.status, 0, result.stderr);
    const hooks = result.stdout;
    assert.ok(existsSync(join(hooks, "prepare-commit-msg")));
    handlers.get("session_shutdown")();
    assert.equal(existsSync(hooks), false);
    handlers.get("session_shutdown")();
  });
});
