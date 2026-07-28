import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const packageRoot = join(import.meta.dirname, "..");
const cli = join(packageRoot, "dist", "cli.js");
const sourceTheme = readFileSync(join(packageRoot, "theme.css"));

const run = (cwd, args = []) =>
  spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });

describe("magic-docs-init", () => {
  it("materializes an idempotent theme and GitHub Pages marker", () => {
    const directory = mkdtempSync(join(tmpdir(), "magic-docs-init-"));
    try {
      const first = run(directory, [
        "--out",
        "src/app/magic-docs.css",
        "--public-dir",
        "static",
      ]);
      assert.equal(first.status, 0, first.stderr);
      assert.match(first.stdout, /created .*magic-docs\.css/);
      assert.match(first.stdout, /created .*\.nojekyll/);
      assert.deepEqual(
        readFileSync(join(directory, "src/app/magic-docs.css")),
        sourceTheme,
      );
      assert.equal(
        readFileSync(join(directory, "static/.nojekyll"), "utf8"),
        "",
      );

      const second = run(directory, [
        "--out",
        "src/app/magic-docs.css",
        "--public-dir",
        "static",
      ]);
      assert.equal(second.status, 0, second.stderr);
      assert.match(second.stdout, /unchanged .*magic-docs\.css/);
      assert.match(second.stdout, /unchanged .*\.nojekyll/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses a local customization unless --force is explicit", () => {
    const directory = mkdtempSync(join(tmpdir(), "magic-docs-init-"));
    try {
      const path = join(directory, "magic-docs.css");
      writeFileSync(path, "/* local */\n");

      const refused = run(directory);
      assert.equal(refused.status, 1);
      assert.match(refused.stderr, /already exists and differs/);
      assert.equal(readFileSync(path, "utf8"), "/* local */\n");

      const replaced = run(directory, ["--force", "--no-pages-marker"]);
      assert.equal(replaced.status, 0, replaced.stderr);
      assert.match(replaced.stdout, /replaced/);
      assert.deepEqual(readFileSync(path), sourceTheme);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects unknown arguments", () => {
    const directory = mkdtempSync(join(tmpdir(), "magic-docs-init-"));
    try {
      const result = run(directory, ["--wat"]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /unknown argument --wat/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
