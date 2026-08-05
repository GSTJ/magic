import { project } from "magic-theme/lib/project.mjs";
import theme, {
  type ThemeTokenColor,
} from "magic-theme/vscode/themes/magic-theme-color-theme.json";

/**
 * Everything in this app draws from the theme the repo publishes, through the
 * same `project()` that powers `magic-theme sync`. No copied hex where an
 * import works; if the theme changes, the next render follows it.
 */
export const PALETTE = project(theme);

const channelAt = (hex: string, offset: number): number =>
  Number.parseInt(hex.slice(offset, offset + 2), 16);

/** Linear blend of two #rrggbb colors, `amount` toward `to`. */
const mix = (from: string, to: string, amount: number): string => {
  const blend = (offset: number): string => {
    const start = channelAt(from, offset);
    const end = channelAt(to, offset);
    return Math.round(start + (end - start) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${blend(1)}${blend(3)}${blend(5)}`;
};

/**
 * The theme has one background role; a scene needs a canvas behind the
 * windows. Derived by darkening, not invented, so it moves with the theme.
 */
export const COLORS = {
  accent: PALETTE.accent,
  ansi: PALETTE.ansi,
  border: PALETTE.border,
  canvas: mix(PALETTE.bg, "#000000", 0.45),
  cyan: PALETTE.ansi[6] ?? PALETTE.accent,
  error: PALETTE.error,
  fg: PALETTE.fg,
  fgMuted: PALETTE.fgMuted,
  line: mix(PALETTE.border, "#000000", 0.3),
  pink: PALETTE.ansi[5] ?? PALETTE.accent,
  selection: PALETTE.selection,
  shadow: mix(PALETTE.bg, "#000000", 0.7),
  success: PALETTE.success,
  surface: PALETTE.bg,
  warning: PALETTE.warning,
} as const;

const scopesOf = (scope: ThemeTokenColor["scope"]): string[] => {
  if (scope === undefined) {
    return [];
  }
  const entries = Array.isArray(scope) ? scope : [scope];
  return entries.flatMap((entry) =>
    entry.split(",").map((part) => part.trim()),
  );
};

const scopeColor = (scope: string, fallback: string): string => {
  const match = theme.tokenColors.find(
    (token) =>
      token.settings?.foreground !== undefined &&
      scopesOf(token.scope).includes(scope),
  );
  return match?.settings?.foreground ?? fallback;
};

/**
 * Token colors looked up in the theme's own `tokenColors` by exact scope.
 * Shiki tokenizes with the full theme JSON for real editor shots; this map is
 * the fallback for hand-built spans (terminal prompts, diagram labels) that
 * never pass through a grammar. `operator` reads the `keyword` rule because
 * the theme colors operators through scope prefix matching, which an exact
 * lookup cannot see.
 */
export const CODE = {
  comment: scopeColor("comment", PALETTE.fgMuted),
  constant: scopeColor("constant", PALETTE.accent),
  fg: PALETTE.fg,
  fn: scopeColor("entity.name.function", PALETTE.success),
  keyword: scopeColor("keyword", PALETTE.accent),
  operator: scopeColor("keyword", PALETTE.fg),
  parameter: scopeColor("variable.parameter", PALETTE.warning),
  punctuation: PALETTE.fg,
  string: scopeColor("string", PALETTE.warning),
  type: scopeColor("entity.name.type", PALETTE.accent),
} as const;
