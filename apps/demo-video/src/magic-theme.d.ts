/**
 * `magic-theme` ships plain .mjs with JSDoc and no declaration files, so tsc
 * has nothing to type its exports with from inside another workspace package.
 * These ambient declarations mirror `lib/project.mjs` and the theme JSON's
 * shape by hand. They are types only; the runtime always loads the real files,
 * so drift here shows up as a type error, never a wrong pixel.
 */
declare module "magic-theme/lib/project.mjs" {
  export type ProjectedTheme = {
    name: string;
    type: "dark" | "light";
    slug: string;
    bg: string;
    fg: string;
    fgMuted: string;
    accent: string;
    border: string;
    selection: string;
    cursor: string;
    success: string;
    error: string;
    warning: string;
    ansi: string[];
    tokenColors: unknown[];
    colors: Record<string, string>;
  };

  export function project(theme: {
    name?: string;
    type?: string;
    colors: Record<string, string>;
    tokenColors?: unknown[];
  }): ProjectedTheme;
}

declare module "magic-theme/vscode/themes/magic-theme-color-theme.json" {
  export type ThemeTokenColor = {
    scope?: string | string[];
    settings?: { fontStyle?: string; foreground?: string };
  };

  const theme: {
    name: string;
    type: string;
    colors: Record<string, string>;
    tokenColors: ThemeTokenColor[];
  };

  export default theme;
}
