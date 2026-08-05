import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("magic-theme", () => {
  it("palette pins #141414 background", () => {
    const palette = JSON.parse(readFileSync(join(root, "palette.json"), "utf8"));
    assert.equal(palette.background, "#141414");
    assert.equal(palette.name, "Dracula 141414");
  });

  it("ships vscode theme with palette background", () => {
    const theme = JSON.parse(
      readFileSync(
        join(root, "vscode", "themes", "dracula-141414-color-theme.json"),
        "utf8",
      ),
    );
    assert.equal(theme.name, "Dracula 141414");
    assert.equal(theme.colors["editor.background"], "#141414");
    assert.ok(Array.isArray(theme.tokenColors));
    assert.ok(theme.tokenColors.length > 0);
  });

  it("ships terminal exports", () => {
    for (const file of [
      "warp.yaml",
      "ghostty",
      "alacritty.toml",
      "windows-terminal.json",
    ]) {
      assert.ok(existsSync(join(root, "terminals", file)), file);
    }
    const warp = readFileSync(join(root, "terminals", "warp.yaml"), "utf8");
    assert.match(warp, /background: '#141414'/);
  });

  it("vscode extension contributes the theme", () => {
    const ext = JSON.parse(readFileSync(join(root, "vscode", "package.json"), "utf8"));
    assert.equal(ext.contributes.themes[0].label, "Dracula 141414");
  });
});
