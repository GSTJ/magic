import type { ThemedToken } from "shiki";

import type { CSSProperties, FC } from "react";

import { Easing, interpolate, useCurrentFrame } from "remotion";

import { COLORS } from "../brand";
import { FONTS } from "../fonts";
import {
  BrandMark,
  CodePane,
  SceneBackground,
  Sparkle,
  Tagline,
  WindowFrame,
} from "../primitives";
import { useTokens } from "../shiki";

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

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const OVERSHOOT = Easing.bezier(0.34, 1.35, 0.64, 1);

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/** Fade a block in at `at`, drifting from `from` (a CSS translate pair). */
const enter = (frame: number, at: number, from: string): CSSProperties => ({
  opacity: interpolate(frame, [at, at + 16], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  }),
  translate: interpolate(frame, [at, at + 18], [from, "0px 0px"], {
    easing: EASE_OUT,
    ...CLAMP,
  }),
});

/**
 * A whole life for blocks the reel later clears: in at `cue[0]` drifting from
 * `from`, out at `cue[1]` drifting to `to`. One interpolate per property
 * across all four stops, so nothing snaps between the halves.
 */
const life = (
  frame: number,
  cue: readonly [number, number],
  from: string,
  to: string,
): CSSProperties => ({
  opacity: interpolate(
    frame,
    [cue[0], cue[0] + 16, cue[1], cue[1] + 15],
    [0, 1, 1, 0],
    { easing: EASE_OUT, ...CLAMP },
  ),
  translate: interpolate(
    frame,
    [cue[0], cue[0] + 18, cue[1], cue[1] + 17],
    [from, "0px 0px", "0px 0px", to],
    { easing: EASE_OUT, ...CLAMP },
  ),
});

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
const Thumb: FC<Artifact & { style?: CSSProperties }> = ({
  file,
  glyph,
  style,
  tint,
}) => (
  <div
    style={{
      width: CARD_WIDTH,
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      boxShadow: `6px 7px 0 ${COLORS.shadow}`,
      overflow: "hidden",
      ...style,
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

/** The frame the sheet's own cascade has finished on; the still renders here. */
const SETTLED = 9999;

/** Where the reel's last scene starts dealing the sheet out. */
const SHEET_AT = 348;

/**
 * The backstage sheet itself. Frame-driven so one layout serves both the hero
 * still (settled) and the reel's closing scene (cards landing one by one);
 * at `SETTLED` every `enter` resolves to opacity 1 and a zero translate, which
 * is the still exactly as it was before the reel existed.
 */
const Sheet: FC<{ frame: number }> = ({ frame }) => (
  <div style={CENTERED}>
    <div style={{ ...TITLE_ROW, ...enter(frame, SHEET_AT, "0px 20px") }}>
      <BrandMark size={44} />
      <div style={NAME}>magic-video</div>
    </div>
    <div style={enter(frame, SHEET_AT + 8, "0px 16px")}>
      <Tagline fontSize={24}>
        Every image in media/, drawn from the published theme
      </Tagline>
    </div>
    <div style={GRID}>
      {SHEET.map((artifact, index) => (
        <Thumb
          key={artifact.file}
          {...artifact}
          style={enter(frame, SHEET_AT + 18 + index * 4, "0px 24px")}
        />
      ))}
    </div>
    <div style={{ ...COMMAND, ...enter(frame, SHEET_AT + 64, "0px 12px") }}>
      pnpm --filter magic-video render:all
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
    <Sheet frame={SETTLED} />
  </SceneBackground>
);

/**
 * Every stage's in and out frame, so the reel's rhythm is readable in one
 * place instead of scattered across a dozen interpolate calls. 450 frames at
 * 30fps: title, editor, palette, sheet.
 */
const CUE = {
  callout: [276, 330],
  header: [98, 330],
  intro: [4, 84],
  palette: [160, 334],
  window: [100, 332],
} as const;

/** The typing window for the snippet, start to last character. */
const TYPE_FROM = 142;
const TYPE_TO = 272;

/**
 * What a consumer writes with this package: the exported primitives, composed.
 * It types itself out in the reel, so it has to be code that would actually
 * run rather than something shaped like it.
 */
const SNIPPET = [
  'import { BrandMark, WindowFrame } from "magic-video/primitives";',
  "",
  "export const Reel = () => (",
  '  <WindowFrame height={420} title="reel.tsx" width={720}>',
  "    <BrandMark size={72} />",
  "  </WindowFrame>",
  ");",
].join("\n");

/**
 * The tokenized snippet cut to its first `visible` characters, with lines the
 * caret has not reached dropped entirely — otherwise `CodePane` prints the
 * whole gutter up front and the file looks typed before a key is pressed.
 */
const typed = (lines: ThemedToken[][], visible: number): ThemedToken[][] => {
  let remaining = visible;
  return lines
    .map((line) => {
      const started = remaining > 0;
      const cut = line.map((token) => {
        const take = Math.max(0, Math.min(token.content.length, remaining));
        remaining -= token.content.length;
        return { ...token, content: token.content.slice(0, take) };
      });
      // The newline the join put back between two lines.
      remaining -= 1;
      return started ? cut : null;
    })
    .filter((line) => line !== null);
};

const Intro: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      ...CENTERED,
      gap: 22,
      ...life(frame, CUE.intro, "0px 26px", "0px -40px"),
    }}
  >
    <div
      style={{
        scale: interpolate(frame, [6, 34], [0.72, 1], {
          easing: OVERSHOOT,
          ...CLAMP,
        }),
      }}
    >
      <BrandMark size={96} />
    </div>
    <div style={{ ...NAME, fontSize: 68, ...enter(frame, 18, "0px 18px") }}>
      magic-video
    </div>
    <div style={enter(frame, 30, "0px 14px")}>
      <Tagline fontSize={27}>
        A brand reel, drawn from the published theme
      </Tagline>
    </div>
  </div>
);

const Header: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 80,
      right: 80,
      height: 96,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      ...life(frame, CUE.header, "0px -12px", "0px -12px"),
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontFamily: FONTS.sans,
        fontWeight: 700,
        fontSize: 27,
        letterSpacing: -0.6,
        color: COLORS.fg,
      }}
    >
      <BrandMark size={36} />
      magic-video
    </div>
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: 19,
        letterSpacing: -0.2,
        color: COLORS.fgMuted,
      }}
    >
      remotion renders it straight into media/
    </div>
  </div>
);

/**
 * The editor half: the window builds itself out of its own title bar, then the
 * snippet types in. Height is animated rather than scaled so the chrome, the
 * radius and the shadow stay at their real thickness the whole way up.
 */
const Editor: FC<{ frame: number }> = ({ frame }) => {
  const lines = useTokens(SNIPPET, "tsx");
  const visible = Math.round(
    interpolate(frame, [TYPE_FROM, TYPE_TO], [0, SNIPPET.length], CLAMP),
  );

  return (
    <WindowFrame
      height={Math.round(
        interpolate(frame, [106, 136], [53, 350], {
          easing: EASE_OUT,
          ...CLAMP,
        }),
      )}
      style={{
        position: "absolute",
        left: 80,
        top: 200,
        ...life(frame, CUE.window, "0px 30px", "-44px 0px"),
      }}
      title="reel.tsx"
      width={840}
    >
      {lines === null ? null : (
        <CodePane fontSize={18} lines={typed(lines, visible)} />
      )}
    </WindowFrame>
  );
};

/** What the editor half is worth, and the command that renders this very GIF. */
const Callout: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      top: 584,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 16,
      ...life(frame, CUE.callout, "0px 18px", "0px -14px"),
    }}
  >
    <Tagline fontSize={23}>
      Import the same primitives this repo draws with
    </Tagline>
    <div style={{ ...COMMAND, marginTop: 0, fontSize: 18 }}>
      pnpm --filter magic-video render:video-gif
    </div>
  </div>
);

/**
 * The roles `project()` derives, in the order the theme README talks about
 * them. Values come through COLORS, so the strip can never disagree with the
 * scene it sits in.
 */
const ROLES = [
  ["accent", COLORS.accent],
  ["success", COLORS.success],
  ["warning", COLORS.warning],
  ["error", COLORS.error],
  ["cyan", COLORS.cyan],
  ["pink", COLORS.pink],
] as const;

const RoleSwatch: FC<{
  frame: number;
  index: number;
  label: string;
  value: string;
}> = ({ frame, index, label, value }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 7,
      ...enter(frame, 190 + index * 7, "22px 0px"),
    }}
  >
    <div
      style={{
        width: 152,
        height: 54,
        borderRadius: 9,
        border: `1px solid ${COLORS.border}`,
        backgroundColor: value,
      }}
    />
    <div
      style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.fgMuted }}
    >
      {label}
    </div>
  </div>
);

const LABEL: CSSProperties = {
  fontFamily: FONTS.mono,
  fontSize: 15,
  letterSpacing: -0.2,
  color: COLORS.fgMuted,
};

/**
 * The palette half: the same theme the snippet's colors came out of, flowing
 * in swatch by swatch. Roles first because they are what a composition names,
 * then the 16 ansi slots the terminal gets.
 */
const Palette: FC<{ frame: number }> = ({ frame }) => (
  <WindowFrame
    height={470}
    style={{
      position: "absolute",
      left: 960,
      top: 200,
      ...life(frame, CUE.palette, "36px 0px", "36px 0px"),
    }}
    title="magic-theme"
    width={560}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        padding: "26px 28px",
      }}
    >
      <div style={{ ...LABEL, ...enter(frame, 176, "0px 10px") }}>roles</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, width: 488 }}>
        {ROLES.map(([label, value], index) => (
          <RoleSwatch
            frame={frame}
            index={index}
            key={label}
            label={label}
            value={value}
          />
        ))}
      </div>
      <div style={{ ...LABEL, ...enter(frame, 240, "0px 10px") }}>
        ansi 0-15
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: 488 }}>
        {COLORS.ansi.map((swatch, index) => (
          <div
            key={index}
            style={{
              width: 52,
              height: 34,
              borderRadius: 7,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: swatch,
              ...enter(frame, 246 + index * 3, "0px 12px"),
            }}
          />
        ))}
      </div>
    </div>
  </WindowFrame>
);

/**
 * The reel: the mark and the name, an editor that assembles and types a real
 * composition, the theme flowing in beside it, and the contact sheet dealing
 * itself out at the end. Sparkles sit in the margins and fire on the cuts, so
 * a transition has something moving in it besides the panel that is leaving.
 */
export const VideoDemo: FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneBackground>
      <Intro frame={frame} />
      <Header frame={frame} />
      <Editor frame={frame} />
      <Callout frame={frame} />
      <Palette frame={frame} />
      <Sheet frame={frame} />
      <Sparkle color={COLORS.pink} delay={12} left="51%" size={19} top="88%" />
      <Sparkle color={COLORS.cyan} delay={104} left="6%" size={15} top="12%" />
      <Sparkle
        color={COLORS.accent}
        delay={236}
        left="96.5%"
        size={22}
        top="62%"
      />
      <Sparkle
        color={COLORS.success}
        delay={352}
        left="3%"
        size={18}
        top="30%"
      />
    </SceneBackground>
  );
};
