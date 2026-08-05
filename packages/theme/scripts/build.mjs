#!/usr/bin/env node
/**
 * Rebuild vscode theme + terminal exports from palette.json.
 * Needs the official Dracula VS Code theme installed in Cursor or VS Code.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const palette = JSON.parse(readFileSync(join(root, "palette.json"), "utf8"));

function findDraculaSync() {
  const home = homedir();
  for (const base of [
    join(home, ".cursor", "extensions"),
    join(home, ".vscode", "extensions"),
  ]) {
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      if (!name.startsWith("dracula-theme.theme-dracula-")) continue;
      const file = join(base, name, "theme", "dracula.json");
      if (existsSync(file)) return file;
    }
  }
  return null;
}

const draculaPath = findDraculaSync();
if (!draculaPath) {
  console.error(
    "official Dracula theme not found under ~/.cursor/extensions or ~/.vscode/extensions",
  );
  process.exit(1);
}

const dracula = JSON.parse(readFileSync(draculaPath, "utf8"));
const bg = palette.background;
const raised = palette.backgroundRaised;
const inp = palette.backgroundInput;
const hover = palette.backgroundHover;
const sel = palette.backgroundSelection;
const insel = palette.backgroundInactiveSelection;
const border = palette.border;
const fg = palette.foreground;
const muted = palette.foregroundMuted;
const soft = palette.foregroundSoft;
const ignored = palette.foregroundIgnored;
const ansi = palette.ansi;

const overlay = {
  "editor.background": bg,
  "editorGutter.background": bg,
  "sideBar.background": bg,
  "sideBar.foreground": "#d0d0d0",
  "sideBar.border": border,
  "sideBarSectionHeader.background": bg,
  "sideBarSectionHeader.border": border,
  "activityBar.background": bg,
  "activityBar.border": border,
  "activityBar.inactiveForeground": soft,
  "titleBar.activeBackground": bg,
  "titleBar.inactiveBackground": bg,
  "titleBar.inactiveForeground": soft,
  "statusBar.background": bg,
  "statusBar.noFolderBackground": bg,
  "statusBar.border": border,
  "panel.background": bg,
  "panel.border": border,
  "panelSectionHeader.background": bg,
  "panelSectionHeader.border": border,
  "panelSectionHeader.foreground": fg,
  "panelTitle.inactiveForeground": soft,
  "terminal.background": bg,
  "tab.activeBackground": bg,
  "tab.inactiveBackground": bg,
  "tab.border": border,
  "tab.inactiveForeground": soft,
  "editorGroupHeader.tabsBackground": bg,
  "editorGroup.border": border,
  "breadcrumb.background": bg,
  "breadcrumb.foreground": soft,
  "breadcrumb.focusForeground": "#c8c8c8",
  "breadcrumb.activeSelectionForeground": "#e8e8e8",
  "minimap.background": bg,
  "input.background": inp,
  "input.border": border,
  "input.placeholderForeground": soft,
  "dropdown.background": inp,
  "dropdown.border": border,
  "list.hoverBackground": hover,
  "list.activeSelectionBackground": sel,
  "list.inactiveSelectionBackground": insel,
  "list.focusBackground": sel,
  "list.deemphasizedForeground": muted,
  "quickInput.background": raised,
  "quickInputList.focusBackground": sel,
  "editorWidget.background": raised,
  "editorWidget.border": border,
  "peekViewEditor.background": bg,
  "peekViewResult.background": raised,
  "peekViewTitle.background": raised,
  "peekViewTitleDescription.foreground": soft,
  "notifications.background": raised,
  "notificationCenterHeader.background": bg,
  "menu.background": raised,
  "menu.selectionBackground": sel,
  "badge.background": "#2a2a2a",
  "badge.foreground": fg,
  "button.background": palette.button,
  "button.hoverBackground": palette.buttonHover,
  "button.foreground": fg,
  "button.secondaryBackground": "#2a2a2a",
  "button.secondaryHoverBackground": palette.button,
  "button.secondaryForeground": fg,
  "toolbar.hoverBackground": "#252525",
  "scrollbarSlider.background": "#ffffff22",
  "scrollbarSlider.hoverBackground": "#ffffff33",
  "scrollbarSlider.activeBackground": "#ffffff44",
  "focusBorder": palette.focusBorder,
  "descriptionForeground": muted,
  "disabledForeground": soft,
  "icon.foreground": soft,
  "tree.indentGuidesStroke": soft,
  "editorLineNumber.foreground": soft,
  "editorLineNumber.activeForeground": palette.foregroundActiveLineNumber,
  "editorCodeLens.foreground": soft,
  "editorGhostText.foreground": `${soft}88`,
  "editorInlayHint.foreground": soft,
  "editorInlayHint.background": "#00000000",
  "editorGutter.commentRangeForeground": soft,
  "editorOverviewRuler.bracketMatchForeground": soft,
  "editorHoverWidget.border": "#3a3a3a",
  "gitDecoration.ignoredResourceForeground": ignored,
  "charts.foreground": soft,
  "textPreformat.foreground": soft,
  "terminal.ansiBlack": ansi.normal.black,
  "terminal.ansiRed": ansi.normal.red,
  "terminal.ansiGreen": ansi.normal.green,
  "terminal.ansiYellow": ansi.normal.yellow,
  "terminal.ansiBlue": ansi.normal.blue,
  "terminal.ansiMagenta": ansi.normal.magenta,
  "terminal.ansiCyan": ansi.normal.cyan,
  "terminal.ansiWhite": ansi.normal.white,
  "terminal.ansiBrightBlack": ansi.bright.black,
  "terminal.ansiBrightRed": ansi.bright.red,
  "terminal.ansiBrightGreen": ansi.bright.green,
  "terminal.ansiBrightYellow": ansi.bright.yellow,
  "terminal.ansiBrightBlue": ansi.bright.blue,
  "terminal.ansiBrightMagenta": ansi.bright.magenta,
  "terminal.ansiBrightCyan": ansi.bright.cyan,
  "terminal.ansiBrightWhite": ansi.bright.white,
};

const colors = { ...dracula.colors, ...overlay };
const theme = {
  $schema: "vscode://schemas/color-theme",
  name: "Dracula 141414",
  type: "dark",
  semanticHighlighting: dracula.semanticHighlighting ?? true,
  colors,
  tokenColors: dracula.tokenColors,
};

writeFileSync(
  join(root, "vscode", "themes", "dracula-141414-color-theme.json"),
  `${JSON.stringify(theme, null, 2)}\n`,
);

const warp = `name: Dracula 141414
accent: '${palette.accent}'
cursor: '${palette.cursor}'
background: '${bg}'
foreground: '${fg}'
details: darker
terminal_colors:
  normal:
    black: '${ansi.normal.black}'
    red: '${ansi.normal.red}'
    green: '${ansi.normal.green}'
    yellow: '${ansi.normal.yellow}'
    blue: '${ansi.normal.blue}'
    magenta: '${ansi.normal.magenta}'
    cyan: '${ansi.normal.cyan}'
    white: '${ansi.normal.white}'
  bright:
    black: '${ansi.bright.black}'
    red: '${ansi.bright.red}'
    green: '${ansi.bright.green}'
    yellow: '${ansi.bright.yellow}'
    blue: '${ansi.bright.blue}'
    magenta: '${ansi.bright.magenta}'
    cyan: '${ansi.bright.cyan}'
    white: '${ansi.bright.white}'
`;
writeFileSync(join(root, "terminals", "warp.yaml"), warp);

const ghostty = `# Dracula 141414 — magic-theme
background = ${bg}
foreground = ${fg}
cursor-color = ${palette.cursor}
selection-background = ${sel}
selection-foreground = ${fg}
palette = 0=${ansi.normal.black}
palette = 1=${ansi.normal.red}
palette = 2=${ansi.normal.green}
palette = 3=${ansi.normal.yellow}
palette = 4=${ansi.normal.blue}
palette = 5=${ansi.normal.magenta}
palette = 6=${ansi.normal.cyan}
palette = 7=${ansi.normal.white}
palette = 8=${ansi.bright.black}
palette = 9=${ansi.bright.red}
palette = 10=${ansi.bright.green}
palette = 11=${ansi.bright.yellow}
palette = 12=${ansi.bright.blue}
palette = 13=${ansi.bright.magenta}
palette = 14=${ansi.bright.cyan}
palette = 15=${ansi.bright.white}
`;
writeFileSync(join(root, "terminals", "ghostty"), ghostty);

const alacritty = `# Dracula 141414 — magic-theme
[colors.primary]
background = "${bg}"
foreground = "${fg}"

[colors.cursor]
text = "${bg}"
cursor = "${palette.cursor}"

[colors.normal]
black = "${ansi.normal.black}"
red = "${ansi.normal.red}"
green = "${ansi.normal.green}"
yellow = "${ansi.normal.yellow}"
blue = "${ansi.normal.blue}"
magenta = "${ansi.normal.magenta}"
cyan = "${ansi.normal.cyan}"
white = "${ansi.normal.white}"

[colors.bright]
black = "${ansi.bright.black}"
red = "${ansi.bright.red}"
green = "${ansi.bright.green}"
yellow = "${ansi.bright.yellow}"
blue = "${ansi.bright.blue}"
magenta = "${ansi.bright.magenta}"
cyan = "${ansi.bright.cyan}"
white = "${ansi.bright.white}"
`;
writeFileSync(join(root, "terminals", "alacritty.toml"), alacritty);

writeFileSync(
  join(root, "terminals", "windows-terminal.json"),
  `${JSON.stringify(
    {
      name: "Dracula 141414",
      background: bg,
      foreground: fg,
      cursorColor: palette.cursor,
      selectionBackground: sel,
      black: ansi.normal.black,
      red: ansi.normal.red,
      green: ansi.normal.green,
      yellow: ansi.normal.yellow,
      blue: ansi.normal.blue,
      purple: ansi.normal.magenta,
      cyan: ansi.normal.cyan,
      white: ansi.normal.white,
      brightBlack: ansi.bright.black,
      brightRed: ansi.bright.red,
      brightGreen: ansi.bright.green,
      brightYellow: ansi.bright.yellow,
      brightBlue: ansi.bright.blue,
      brightPurple: ansi.bright.magenta,
      brightCyan: ansi.bright.cyan,
      brightWhite: ansi.bright.white,
    },
    null,
    2,
  )}\n`,
);

const vscodePkgPath = join(root, "vscode", "package.json");
const vscodePkg = JSON.parse(readFileSync(vscodePkgPath, "utf8"));
const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
vscodePkg.version = rootPkg.version;
writeFileSync(vscodePkgPath, `${JSON.stringify(vscodePkg, null, 2)}\n`);

console.log(`rebuilt from ${draculaPath}`);
