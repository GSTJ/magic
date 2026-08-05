import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { toClaude, toTmTheme, toWarp } from "../lib/formats.mjs";
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

  it("renders warp / claude / tmTheme from the same theme", () => {
    assert.match(toWarp(theme), /background: '#141414'/);
    const claude = JSON.parse(toClaude(theme));
    assert.equal(claude.name, "Dracula 141414");
    assert.equal(claude.overrides.background, "#141414");
    assert.match(toTmTheme(theme), /<string>#141414<\/string>/);
  });
});
