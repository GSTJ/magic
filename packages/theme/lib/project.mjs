/**
 * Project a VS Code theme into the small role set terminals need.
 * Prefer terminal.ansi*; fall back only when missing.
 */
const ANSI_KEYS = [
  "terminal.ansiBlack",
  "terminal.ansiRed",
  "terminal.ansiGreen",
  "terminal.ansiYellow",
  "terminal.ansiBlue",
  "terminal.ansiMagenta",
  "terminal.ansiCyan",
  "terminal.ansiWhite",
  "terminal.ansiBrightBlack",
  "terminal.ansiBrightRed",
  "terminal.ansiBrightGreen",
  "terminal.ansiBrightYellow",
  "terminal.ansiBrightBlue",
  "terminal.ansiBrightMagenta",
  "terminal.ansiBrightCyan",
  "terminal.ansiBrightWhite",
];

/** @param {Record<string, string | undefined>} colors */
const pick = (colors, keys, fallback) => {
  for (const k of keys) {
    const v = colors[k];
    if (v) return v.length === 9 ? v.slice(0, 7) : v;
  }
  return fallback;
};

/** @param {string} name */
const slugify = (name) =>
  name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");

/** @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: unknown[] }} theme */
export function project(theme) {
  const c = theme.colors;
  const name = theme.name ?? "Magic Dracula";
  const ansi = ANSI_KEYS.map((k, i) =>
    pick(c, [k], i < 8 ? "#888888" : "#cccccc"),
  );
  return {
    name,
    type: theme.type === "light" ? "light" : "dark",
    slug: slugify(name),
    bg: pick(c, ["editor.background", "terminal.background"], "#141414"),
    fg: pick(c, ["editor.foreground", "foreground"], "#f8f8f2"),
    fgMuted: pick(c, ["descriptionForeground", "editorLineNumber.foreground"], "#6e6e76"),
    accent: pick(c, ["activityBarBadge.background", "focusBorder"], "#bd93f9"),
    border: pick(c, ["panel.border", "sideBar.border"], "#2e2e2e"),
    selection: pick(c, ["editor.selectionBackground", "list.activeSelectionBackground"], "#1c1c1c"),
    cursor: pick(c, ["editorCursor.foreground", "terminalCursor.foreground"], "#f8f8f2"),
    success: pick(c, ["testing.iconPassed", "gitDecoration.addedResourceForeground"], ansi[2]),
    error: pick(c, ["errorForeground", "gitDecoration.deletedResourceForeground"], ansi[1]),
    warning: pick(c, ["editorWarning.foreground"], ansi[3]),
    ansi,
    tokenColors: theme.tokenColors ?? [],
    colors: c,
  };
}
