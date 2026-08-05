import type { CSSProperties, FC } from "react";

import { COLORS } from "../brand";
import { FONTS } from "../fonts";
import { BrandMark, SceneBackground, Tagline } from "../primitives";

/**
 * One entry per file `render:all` writes into media/. `glyph` is a 24x24
 * stroke path, and `tint` cycles the theme's accent roles so the sheet reads
 * as one set instead of ten unrelated thumbnails. Add a composition, add a
 * row here: this still is the package's own index of what it draws.
 */
type Artifact = { file: string; glyph: string; tint: string };

const SHEET: Artifact[] = [
  {
    file: "magic-theme.png",
    glyph: "M12 3.5 18 11a6 6 0 1 1-12 0l6-7.5Z",
    tint: COLORS.accent,
  },
  {
    file: "magic-codemods-demo.gif",
    glyph: "M4 6h16v12H4zM10.5 9.5 15 12l-4.5 2.5z",
    tint: COLORS.cyan,
  },
  {
    file: "magic-oxfmt-config.png",
    glyph: "M4 7h16M4 12h10M4 17h13",
    tint: COLORS.pink,
  },
  {
    file: "magic-oxlint-config.png",
    glyph:
      "M12 3.5 19 6v6c0 4-3.2 7.2-7 8.5-3.8-1.3-7-4.5-7-8.5V6l7-2.5ZM9 12l2.2 2.2L15.5 10",
    tint: COLORS.success,
  },
  {
    file: "magic-oxlint-plugin.png",
    glyph: "M9 3.5V8M15 3.5V8M6 8h12v3.2A6 6 0 0 1 6 11.2V8ZM12 17.2v3.3",
    tint: COLORS.warning,
  },
  {
    file: "magic-tsconfig.png",
    glyph:
      "M10 4c-2.6 0-2.2 5.5-4.5 8 2.3 2.5 1.9 8 4.5 8M14 4c2.6 0 2.2 5.5 4.5 8-2.3 2.5-1.9 8-4.5 8",
    tint: COLORS.accent,
  },
  {
    file: "magic-docs.png",
    glyph:
      "M12 7.5C10.4 6 8.2 5.2 5 5.2v12c3.2 0 5.4.8 7 2.3 1.6-1.5 3.8-2.3 7-2.3v-12c-3.2 0-5.4.8-7 2.3M12 7.5v12",
    tint: COLORS.cyan,
  },
  {
    file: "magic-observability.png",
    glyph: "M3 12h4l3-7 4 14 3-7h4",
    tint: COLORS.pink,
  },
  {
    file: "magic-readme.png",
    glyph: "M6.5 3.5h7L18 8v12H6.5zM13.5 3.5V8H18M9.5 12.5h5M9.5 16h5",
    tint: COLORS.success,
  },
  {
    file: "magic-social.png",
    glyph:
      "M17.5 4.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM6.5 9.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM17.5 15.1a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM8.6 11 15.4 7.6M8.6 13 15.4 16.4",
    tint: COLORS.warning,
  },
];

/** Five across, two down, inside the background's 48px side rules. */
const CARD_WIDTH = 276;
const PREVIEW_HEIGHT = 118;

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 26,
};

const TITLE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const NAME: CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 700,
  fontSize: 44,
  letterSpacing: -1.4,
  color: COLORS.fg,
};

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `repeat(5, ${CARD_WIDTH}px)`,
  gap: 24,
};

const COMMAND: CSSProperties = {
  marginTop: 4,
  padding: "8px 18px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 9,
  backgroundColor: COLORS.surface,
  fontFamily: FONTS.mono,
  fontSize: 17,
  letterSpacing: -0.3,
  color: COLORS.fgMuted,
};

/** A contact-sheet frame: tinted preview holding the glyph, filename under it. */
const Thumb: FC<Artifact> = ({ file, glyph, tint }) => (
  <div
    style={{
      width: CARD_WIDTH,
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      boxShadow: `6px 7px 0 ${COLORS.shadow}`,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: PREVIEW_HEIGHT,
        borderBottom: `1px solid ${COLORS.border}`,
        backgroundColor: `${tint}14`,
      }}
    >
      <svg fill="none" viewBox="0 0 24 24" style={{ width: 44, height: 44 }}>
        <path
          d={glyph}
          stroke={tint}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.6}
        />
      </svg>
    </div>
    <div
      style={{
        padding: "13px 15px",
        fontFamily: FONTS.mono,
        fontSize: 14,
        letterSpacing: -0.3,
        color: COLORS.fgMuted,
      }}
    >
      {file}
    </div>
  </div>
);

/**
 * Hero still: the backstage sheet. Every other composition in this package
 * draws one package's picture; this one draws the shelf they all sit on, so
 * the package README shows its own output without picking a favorite.
 */
export const VideoStill: FC = () => (
  <SceneBackground>
    <div style={CENTERED}>
      <div style={TITLE_ROW}>
        <BrandMark size={44} />
        <div style={NAME}>magic-video</div>
      </div>
      <Tagline fontSize={24}>
        Every image in media/, drawn from the published theme
      </Tagline>
      <div style={GRID}>
        {SHEET.map((artifact) => (
          <Thumb key={artifact.file} {...artifact} />
        ))}
      </div>
      <div style={COMMAND}>pnpm --filter magic-video render:all</div>
    </div>
  </SceneBackground>
);
