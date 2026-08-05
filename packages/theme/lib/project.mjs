/**
 * Project a VS Code theme into the small role set terminals/agents need.
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
function pick(colors, keys, fallback) {
  for (const k of keys) {
    const v = colors[k];
    if (v) return v.length === 9 ? v.slice(0, 7) : v;
  }
  return fallback;
}

/** @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: unknown[] }} theme */
export function project(theme) {
  const c = theme.colors;
  const ansi = ANSI_KEYS.map((k, i) =>
    pick(c, [k], i < 8 ? "#888888" : "#cccccc"),
  );
  return {
    name: theme.name ?? "Dracula 141414",
    type: theme.type === "light" ? "light" : "dark",
    slug: "dracula-141414",
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
