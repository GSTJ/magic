import { project } from "./project.mjs";

/** @param {ReturnType<typeof project>} p */
function ansiBlock(p) {
  const [n0, n1, n2, n3, n4, n5, n6, n7, b0, b1, b2, b3, b4, b5, b6, b7] = p.ansi;
  return { n0, n1, n2, n3, n4, n5, n6, n7, b0, b1, b2, b3, b4, b5, b6, b7 };
}

/** @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: unknown[] }} theme */
export function toWarp(theme) {
  const p = project(theme);
  const a = ansiBlock(p);
  return `name: ${p.name}
accent: '${p.accent}'
cursor: '${p.cursor}'
background: '${p.bg}'
foreground: '${p.fg}'
details: ${p.type === "light" ? "lighter" : "darker"}
terminal_colors:
  normal:
    black: '${a.n0}'
    red: '${a.n1}'
    green: '${a.n2}'
    yellow: '${a.n3}'
    blue: '${a.n4}'
    magenta: '${a.n5}'
    cyan: '${a.n6}'
    white: '${a.n7}'
  bright:
    black: '${a.b0}'
    red: '${a.b1}'
    green: '${a.b2}'
    yellow: '${a.b3}'
    blue: '${a.b4}'
    magenta: '${a.b5}'
    cyan: '${a.b6}'
    white: '${a.b7}'
`;
}

/** @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: unknown[] }} theme */
export function toGhostty(theme) {
  const p = project(theme);
  const lines = [
    `# ${p.name} — magic-theme`,
    `background = ${p.bg}`,
    `foreground = ${p.fg}`,
    `cursor-color = ${p.cursor}`,
    `selection-background = ${p.selection}`,
    `selection-foreground = ${p.fg}`,
  ];
  p.ansi.forEach((c, i) => lines.push(`palette = ${i}=${c}`));
  return `${lines.join("\n")}\n`;
}

/** @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: unknown[] }} theme */
export function toAlacritty(theme) {
  const p = project(theme);
  const a = ansiBlock(p);
  return `# ${p.name} — magic-theme
[colors.primary]
background = "${p.bg}"
foreground = "${p.fg}"

[colors.cursor]
text = "${p.bg}"
cursor = "${p.cursor}"

[colors.normal]
black = "${a.n0}"
red = "${a.n1}"
green = "${a.n2}"
yellow = "${a.n3}"
blue = "${a.n4}"
magenta = "${a.n5}"
cyan = "${a.n6}"
white = "${a.n7}"

[colors.bright]
black = "${a.b0}"
red = "${a.b1}"
green = "${a.b2}"
yellow = "${a.b3}"
blue = "${a.b4}"
magenta = "${a.b5}"
cyan = "${a.b6}"
white = "${a.b7}"
`;
}

/** @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: unknown[] }} theme */
export function toWindowsTerminal(theme) {
  const p = project(theme);
  const a = ansiBlock(p);
  return `${JSON.stringify(
    {
      name: p.name,
      background: p.bg,
      foreground: p.fg,
      cursorColor: p.cursor,
      selectionBackground: p.selection,
      black: a.n0,
      red: a.n1,
      green: a.n2,
      yellow: a.n3,
      blue: a.n4,
      purple: a.n5,
      cyan: a.n6,
      white: a.n7,
      brightBlack: a.b0,
      brightRed: a.b1,
      brightGreen: a.b2,
      brightYellow: a.b3,
      brightBlue: a.b4,
      brightPurple: a.b5,
      brightCyan: a.b6,
      brightWhite: a.b7,
    },
    null,
    2,
  )}\n`;
}

/** Claude Code custom theme (~/.claude/themes/<slug>.json) */
/** @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: unknown[] }} theme */
export function toClaude(theme) {
  const p = project(theme);
  const a = p.ansi;
  return `${JSON.stringify(
    {
      name: p.name,
      base: p.type,
      overrides: {
        background: p.bg,
        text: p.fg,
        inactive: p.fgMuted,
        subtle: p.fgMuted,
        claude: p.accent,
        claudeShimmer: a[13],
        promptBorder: p.border,
        permission: p.accent,
        planMode: a[4],
        success: p.success,
        error: p.error,
        warning: p.warning,
        diffAdded: p.success,
        diffRemoved: p.error,
        ide: a[5],
        remember: a[5],
        userMessageBackground: p.bg,
        selectionBg: p.selection,
      },
    },
    null,
    2,
  )}\n`;
}

/** Escape text for TextMate plist XML. */
function xml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** @param {string} key @param {string} value */
function dictEntry(key, value) {
  return `      <key>${xml(key)}</key>\n      <string>${xml(value)}</string>\n`;
}

/**
 * Codex / bat / Sublime TextMate theme.
 * @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: Array<{ name?: string, scope?: string | string[], settings?: Record<string, string> }> }} theme
 */
export function toTmTheme(theme) {
  const p = project(theme);
  const globals = {
    background: p.bg,
    foreground: p.fg,
    caret: p.cursor,
    selection: p.selection,
    lineHighlight: pick(p.colors, ["editor.lineHighlightBackground"], p.selection),
  };

  let settingsXml = `    <dict>\n      <key>settings</key>\n      <dict>\n`;
  for (const [k, v] of Object.entries(globals)) {
    settingsXml += dictEntry(k, v);
  }
  settingsXml += `      </dict>\n    </dict>\n`;

  for (const rule of p.tokenColors) {
    if (!rule?.settings) continue;
    const scope = Array.isArray(rule.scope)
      ? rule.scope.join(", ")
      : rule.scope;
    settingsXml += `    <dict>\n`;
    if (rule.name) settingsXml += dictEntry("name", rule.name);
    if (scope) settingsXml += dictEntry("scope", scope);
    settingsXml += `      <key>settings</key>\n      <dict>\n`;
    for (const [k, v] of Object.entries(rule.settings)) {
      if (v != null && v !== "") settingsXml += dictEntry(k, String(v).slice(0, 7));
    }
    settingsXml += `      </dict>\n    </dict>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>name</key>
  <string>${xml(p.name)}</string>
  <key>semanticClass</key>
  <string>theme.${p.type}.${p.slug}</string>
  <key>uuid</key>
  <string>d1414141-4141-4141-4141-414141414141</string>
  <key>colorSpaceName</key>
  <string>sRGB</string>
  <key>settings</key>
  <array>
${settingsXml}  </array>
</dict>
</plist>
`;
}

function pick(colors, keys, fallback) {
  for (const k of keys) {
    const v = colors[k];
    if (v) return v.length === 9 ? v.slice(0, 7) : v;
  }
  return fallback;
}
