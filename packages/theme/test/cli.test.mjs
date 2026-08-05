import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const cli = join(import.meta.dirname, "..", "bin", "magic-theme.mjs");

test("install replaces a theme symlink without overwriting its target", () => {
  const home = mkdtempSync(join(tmpdir(), "magic-theme-home-"));
  try {
    const directory = join(home, ".warp", "themes");
    const sentinel = join(home, "sentinel.yaml");
    const destination = join(directory, "magic-theme.yaml");
    mkdirSync(directory, { recursive: true });
    writeFileSync(sentinel, "keep me\n");
    symlinkSync(sentinel, destination);

    const result = spawnSync(process.execPath, [cli, "install", "warp"], {
      encoding: "utf8",
      env: { HOME: home },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(sentinel, "utf8"), "keep me\n");
    const descriptor = openSync(destination, constants.O_NOFOLLOW);
    try {
      assert.equal(fstatSync(descriptor).isFile(), true);
      assert.match(readFileSync(descriptor, "utf8"), /accent:/u);
    } finally {
      closeSync(descriptor);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
