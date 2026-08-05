import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { toWarp } from "../lib/formats.mjs";
import { project } from "../lib/project.mjs";

const root = join(import.meta.dirname, "..");
const theme = JSON.parse(
  readFileSync(
    join(root, "vscode", "themes", "magic-dracula-color-theme.json"),
    "utf8",
  ),
);

describe("magic-theme", () => {
  it("projects Magic Dracula from the vscode theme", () => {
    const p = project(theme);
    assert.equal(p.name, "Magic Dracula");
    assert.equal(p.slug, "magic-dracula");
    assert.equal(p.ansi.length, 16);
  });

  it("renders warp with the theme name", () => {
    assert.match(toWarp(theme), /^name: Magic Dracula/m);
  });
});
