import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { toWarp } from "../lib/formats.mjs";
import { project } from "../lib/project.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const theme = JSON.parse(
  readFileSync(join(root, "vscode", "themes", "dracula-141414-color-theme.json"), "utf8"),
);

describe("magic-theme", () => {
  it("projects #141414 from the vscode theme", () => {
    const p = project(theme);
    assert.equal(p.bg, "#141414");
    assert.equal(p.ansi.length, 16);
  });

  it("renders warp from the same theme", () => {
    assert.match(toWarp(theme), /background: '#141414'/);
  });
});
