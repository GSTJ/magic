import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const cli = join(import.meta.dirname, "..", "bin", "magic-readme.mjs");

test("init refuses an existing symlink without overwriting its target", () => {
  const directory = mkdtempSync(join(tmpdir(), "magic-readme-init-"));
  try {
    const sentinel = join(directory, "sentinel.md");
    const destination = join(directory, "README.md");
    writeFileSync(sentinel, "keep me\n");
    symlinkSync(sentinel, destination);

    const result = spawnSync(process.execPath, [cli, "init", directory], {
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /README\.md already exists/u);
    assert.equal(readFileSync(sentinel, "utf8"), "keep me\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
