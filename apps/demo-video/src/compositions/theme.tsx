import type { CSSProperties, FC } from "react";

import { COLORS, PALETTE } from "../brand";
import { FONTS } from "../fonts";
import {
  BrandMark,
  CodePane,
  SceneBackground,
  Tagline,
  WindowFrame,
} from "../primitives";
import { useTokens } from "../shiki";

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 40,
};

const NAME: CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 700,
  fontSize: 56,
  letterSpacing: -2,
  color: COLORS.fg,
};

/**
 * The snippet the editor window shows. Real usage of this repo's own API, so
 * the hero doubles as documentation; shiki tokenizes it with the published
 * theme JSON, which makes every color in the pane the theme's actual output.
 */
const SNIPPET = [
  "// One theme JSON is the source of truth.",
  'import { project } from "magic-theme/lib/project.mjs";',
  'import theme from "./magic-theme-color-theme.json";',
  "",
  "const roles = project(theme);",
  "",
  "export const window = {",
  "  background: roles.bg,",
  "  accent: roles.accent,",
  "  ansi: roles.ansi,",
  "};",
].join("\n");

/** What `magic-theme install` prints, paths shortened to fit the pane. */
const INSTALL_OUTPUT = [
  "installed cursor -> ~/.cursor/extensions",
  "installed warp -> ~/.warp/themes",
  "installed ghostty -> ~/.config/ghostty",
];

/** A row of color swatches; the terminal shows two, the palette still one. */
const AnsiRow: FC<{ colors: string[]; gap?: number; size: number }> = ({
  colors,
  gap = 8,
  size,
}) => (
  <div style={{ display: "flex", gap }}>
    {colors.map((swatch, index) => (
      <div
        key={index}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.18,
          border: `1px solid ${COLORS.border}`,
          backgroundColor: swatch,
        }}
      />
    ))}
  </div>
);

const EditorWindow: FC = () => {
  const lines = useTokens(SNIPPET, "typescript");

  return (
    <WindowFrame height={480} title="project.ts" width={840}>
      {lines === null ? null : <CodePane fontSize={20} lines={lines} />}
    </WindowFrame>
  );
};

/**
 * An install run followed by the 16 ANSI swatches the run just themed, then a
 * fresh prompt. The swatch grid is the terminal half of the promise the editor
 * half makes: same JSON, same colors.
 */
const TerminalWindow: FC = () => (
  <WindowFrame height={480} title="terminal" width={560}>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 13,
        padding: "26px 28px",
        fontFamily: FONTS.mono,
        fontSize: 17,
        letterSpacing: -0.2,
      }}
    >
      <div style={{ color: COLORS.fg }}>
        <span style={{ color: COLORS.success }}>$ </span>
        magic-theme install
      </div>
      {INSTALL_OUTPUT.map((line) => (
        <div key={line} style={{ color: COLORS.fgMuted }}>
          {line}
        </div>
      ))}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          margin: "14px 0",
        }}
      >
        <AnsiRow colors={COLORS.ansi.slice(0, 8)} size={46} />
        <AnsiRow colors={COLORS.ansi.slice(8, 16)} size={46} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: COLORS.success }}>$</span>
        <div
          style={{ width: 11, height: 22, backgroundColor: PALETTE.cursor }}
        />
      </div>
    </div>
  </WindowFrame>
);

/** Hero: the same theme rendered by an editor and a terminal, side by side. */
export const ThemeStill: FC = () => (
  <SceneBackground>
    <div style={CENTERED}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <BrandMark size={54} />
          <div style={NAME}>magic-theme</div>
        </div>
        <Tagline>The same JSON in the editor and the terminal</Tagline>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 40 }}>
        <EditorWindow />
        <TerminalWindow />
      </div>
    </div>
  </SceneBackground>
);

/**
 * The six roles `project()` derives, in the order the README talks about them.
 * Values come through COLORS so the strip can never disagree with the scenes.
 */
const ROLES = [
  ["bg", COLORS.surface],
  ["fg", COLORS.fg],
  ["accent", COLORS.accent],
  ["success", COLORS.success],
  ["error", COLORS.error],
  ["warning", COLORS.warning],
] as const;

const RoleCard: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
    }}
  >
    <div
      style={{
        width: 148,
        height: 62,
        borderRadius: 10,
        border: `1px solid ${COLORS.border}`,
        backgroundColor: value,
      }}
    />
    <div style={{ fontFamily: FONTS.mono, fontSize: 16, color: COLORS.fg }}>
      {label}
    </div>
    <div
      style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.fgMuted }}
    >
      {value}
    </div>
  </div>
);

/** The labeled palette strip used lower in the theme README. */
export const ThemePaletteStill: FC = () => (
  <SceneBackground>
    <div style={{ ...CENTERED, gap: 26 }}>
      <div style={{ ...NAME, fontSize: 42 }}>magic-theme</div>
      <div style={{ display: "flex", gap: 22 }}>
        {ROLES.map(([label, value]) => (
          <RoleCard key={label} label={label} value={value} />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <AnsiRow colors={COLORS.ansi} gap={10} size={54} />
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 15,
            color: COLORS.fgMuted,
          }}
        >
          ansi 0-15
        </div>
      </div>
    </div>
  </SceneBackground>
);
