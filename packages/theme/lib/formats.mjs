import { project } from "./project.mjs";

/** @param {ReturnType<typeof project>} p */
const ansiBlock = (p) => {
  const [n0, n1, n2, n3, n4, n5, n6, n7, b0, b1, b2, b3, b4, b5, b6, b7] =
    p.ansi;
  return { n0, n1, n2, n3, n4, n5, n6, n7, b0, b1, b2, b3, b4, b5, b6, b7 };
};

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
    `# ${p.name} - magic-theme`,
    `background = ${p.bg}`,
    `foreground = ${p.fg}`,
    `cursor-color = ${p.cursor}`,
    `selection-background = ${p.selection}`,
    `selection-foreground = ${p.fg}`,
  ];
  for (const [i, c] of p.ansi.entries()) lines.push(`palette = ${i}=${c}`);
  return `${lines.join("\n")}\n`;
}

/** @param {{ name?: string, type?: string, colors: Record<string, string>, tokenColors?: unknown[] }} theme */
export function toAlacritty(theme) {
  const p = project(theme);
  const a = ansiBlock(p);
  return `# ${p.name} - magic-theme
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
