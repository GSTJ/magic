import type { CSSProperties, FC } from "react";

import { Easing, interpolate, useCurrentFrame } from "remotion";

import { CODE, COLORS } from "../brand";
import { FONTS } from "../fonts";
import {
  BrandMark,
  SceneBackground,
  Sparkle,
  Tagline,
  WindowFrame,
} from "../primitives";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

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

type Segment = { readonly color: string; readonly text: string };

type Line = {
  readonly at: number;
  readonly gap?: boolean;
  readonly segments: readonly Segment[];
};

/** Old name (pre-padded to the arrow column), arrow, kebab target. */
const renameRow = (at: number, from: string, to: string): Line => ({
  at,
  segments: [
    { color: COLORS.fg, text: from },
    { color: COLORS.accent, text: "->" },
    { color: COLORS.success, text: `  ${to}` },
  ],
});

const PROMPT_DRY: readonly Segment[] = [
  { color: COLORS.fgMuted, text: "pnpm exec " },
  { color: COLORS.fg, text: "magic-kebab " },
  { color: COLORS.cyan, text: "--dry-run" },
];

const PROMPT_WRITE: readonly Segment[] = [
  { color: COLORS.fgMuted, text: "pnpm exec " },
  { color: COLORS.fg, text: "magic-kebab " },
  { color: COLORS.pink, text: "--write" },
];

const PLAN_LINES: readonly Line[] = [
  { at: 74, gap: true, segments: [{ color: COLORS.accent, text: "PLAN" }] },
  renameRow(82, "  Button.tsx             ", "button.tsx"),
  renameRow(89, "  formatDate.ts          ", "format-date.ts"),
  renameRow(96, "  parseURLQuery.ts       ", "parse-url-query.ts"),
  {
    at: 106,
    gap: true,
    segments: [{ color: COLORS.warning, text: "SKIPPED" }],
  },
  {
    at: 113,
    segments: [
      { color: COLORS.fg, text: "  [postId].tsx               " },
      { color: COLORS.fgMuted, text: "route parameter" },
    ],
  },
  {
    at: 120,
    segments: [
      { color: COLORS.fg, text: "  __mocks__/AsyncStorage.ts  " },
      { color: COLORS.fgMuted, text: "mocks a package" },
    ],
  },
  {
    at: 132,
    gap: true,
    segments: [
      { color: COLORS.fg, text: "3 renames, 4 imports to rewrite. " },
      { color: COLORS.fgMuted, text: "nothing written." },
    ],
  },
];

const APPLY_LINES: readonly Line[] = [
  {
    at: 206,
    gap: true,
    segments: [{ color: COLORS.fg, text: "rewrote 4 imports in 3 files" }],
  },
  renameRow(214, "  Button.tsx             ", "button.tsx"),
  renameRow(221, "  formatDate.ts          ", "format-date.ts"),
  renameRow(228, "  parseURLQuery.ts       ", "parse-url-query.ts"),
  {
    at: 242,
    gap: true,
    segments: [
      { color: COLORS.success, text: "done." },
      { color: COLORS.fgMuted, text: "  verify: tsc && lint && test" },
    ],
  },
];

/** Cut every segment down to the first `visible` characters overall. */
const sliceSegments = (
  segments: readonly Segment[],
  visible: number,
): Segment[] => {
  let remaining = visible;
  return segments.map((segment) => {
    const take = Math.max(0, Math.min(segment.text.length, remaining));
    remaining -= segment.text.length;
    return { color: segment.color, text: segment.text.slice(0, take) };
  });
};

const TermLine: FC<{ frame: number; line: Line }> = ({ frame, line }) => (
  <div
    style={{
      marginTop: line.gap === true ? 12 : 0,
      opacity: interpolate(frame, [line.at, line.at + 9], [0, 1], {
        easing: EASE_OUT,
        ...CLAMP,
      }),
      translate: interpolate(
        frame,
        [line.at, line.at + 12],
        ["0px 8px", "0px 0px"],
        { easing: EASE_OUT, ...CLAMP },
      ),
    }}
  >
    {line.segments.map((segment) => (
      <span key={segment.text} style={{ color: segment.color }}>
        {segment.text}
      </span>
    ))}
  </div>
);

/**
 * A typed command: `$`, then the segments appearing one character per tick,
 * with a block caret that holds until the command's output starts.
 */
const PromptLine: FC<{
  command: readonly Segment[];
  frame: number;
  from: number;
  gap?: boolean;
  hideCaretAt: number;
  to: number;
}> = ({ command, frame, from, gap = false, hideCaretAt, to }) => {
  const total = command.map((segment) => segment.text).join("").length;
  const visible = Math.round(interpolate(frame, [from, to], [0, total], CLAMP));

  return (
    <div
      style={{
        marginTop: gap ? 12 : 0,
        opacity: interpolate(frame, [from - 4, from], [0, 1], CLAMP),
      }}
    >
      <span style={{ color: COLORS.accent }}>{"$ "}</span>
      {sliceSegments(command, visible).map((segment) => (
        <span
          key={segment.color + segment.text}
          style={{ color: segment.color }}
        >
          {segment.text}
        </span>
      ))}
      <span
        style={{
          display: "inline-block",
          width: 11,
          height: 21,
          marginLeft: 2,
          verticalAlign: "text-bottom",
          backgroundColor: COLORS.fg,
          opacity: interpolate(
            frame,
            [hideCaretAt, hideCaretAt + 6],
            [0.9, 0],
            CLAMP,
          ),
        }}
      />
    </div>
  );
};

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
      ...enter(frame, 2, "0px -10px"),
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
      magic-codemods
    </div>
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: 19,
        letterSpacing: -0.2,
        color: COLORS.fgMuted,
      }}
    >
      kebab-case the files, rewrite every import
    </div>
  </div>
);

const Terminal: FC<{ frame: number }> = ({ frame }) => (
  <WindowFrame
    height={660}
    style={{
      position: "absolute",
      left: 80,
      top: 150,
      ...enter(frame, 6, "0px 26px"),
    }}
    title="magic-kebab"
    width={760}
  >
    <div
      style={{
        padding: "24px 30px",
        fontFamily: FONTS.mono,
        fontSize: 20,
        lineHeight: 1.55,
        letterSpacing: -0.3,
        whiteSpace: "pre",
        color: COLORS.fg,
      }}
    >
      <PromptLine
        command={PROMPT_DRY}
        frame={frame}
        from={18}
        hideCaretAt={72}
        to={64}
      />
      {PLAN_LINES.map((line) => (
        <TermLine frame={frame} key={line.at} line={line} />
      ))}
      <PromptLine
        command={PROMPT_WRITE}
        frame={frame}
        from={152}
        gap
        hideCaretAt={204}
        to={196}
      />
      {APPLY_LINES.map((line) => (
        <TermLine frame={frame} key={line.at} line={line} />
      ))}
    </div>
  </WindowFrame>
);

/** One import line whose specifier flashes and lands on the kebab name. */
const ImportLine: FC<{
  frame: number;
  name: string;
  specAfter: string;
  specBefore: string;
  swapAt: number;
}> = ({ frame, name, specAfter, specBefore, swapAt }) => (
  <div>
    <span style={{ color: CODE.keyword }}>{"import "}</span>
    <span style={{ color: CODE.punctuation }}>{"{ "}</span>
    <span style={{ color: CODE.fg }}>{name}</span>
    <span style={{ color: CODE.punctuation }}>{" } "}</span>
    <span style={{ color: CODE.keyword }}>{"from "}</span>
    <span style={{ position: "relative" }}>
      <span
        style={{
          position: "absolute",
          inset: "-1px -5px",
          borderRadius: 5,
          backgroundColor: COLORS.selection,
          opacity: interpolate(
            frame,
            [swapAt, swapAt + 3, swapAt + 14, swapAt + 24],
            [0, 0.9, 0.9, 0],
            CLAMP,
          ),
        }}
      />
      <span style={{ position: "relative", color: CODE.string }}>
        {`"${frame < swapAt + 3 ? specBefore : specAfter}"`}
      </span>
    </span>
    <span style={{ color: CODE.punctuation }}>;</span>
  </div>
);

const Editor: FC<{ frame: number }> = ({ frame }) => (
  <WindowFrame
    height={220}
    style={{
      position: "absolute",
      left: 900,
      top: 190,
      ...enter(frame, 96, "26px 0px"),
    }}
    title="screen.tsx"
    width={620}
  >
    <div
      style={{
        display: "flex",
        gap: 24,
        padding: "30px 30px",
        fontFamily: FONTS.mono,
        fontSize: 18,
        lineHeight: 1.9,
        letterSpacing: -0.3,
        whiteSpace: "pre",
      }}
    >
      <div style={{ color: COLORS.fgMuted, opacity: 0.55, textAlign: "right" }}>
        <div>01</div>
        <div>02</div>
      </div>
      <div>
        <ImportLine
          frame={frame}
          name="Button"
          specAfter="./button"
          specBefore="./Button"
          swapAt={214}
        />
        <ImportLine
          frame={frame}
          name="formatDate"
          specAfter="./format-date"
          specBefore="./formatDate"
          swapAt={221}
        />
      </div>
    </div>
  </WindowFrame>
);

const CommitNote: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      left: 900,
      top: 452,
      ...enter(frame, 256, "0px 14px"),
    }}
  >
    <Tagline fontSize={27}>one rename-only commit; history survives</Tagline>
  </div>
);

const InstallCard: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      left: 900,
      top: 600,
      width: 620,
      height: 130,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 14,
      boxShadow: `10px 12px 0 ${COLORS.shadow}`,
      overflow: "hidden",
      ...enter(frame, 330, "0px 26px"),
    }}
  >
    <div
      style={{
        fontFamily: FONTS.mono,
        fontWeight: 650,
        fontSize: 27,
        letterSpacing: -0.8,
        color: COLORS.fg,
      }}
    >
      <span style={{ color: COLORS.accent }}>pnpm add -D </span>
      magic-codemods
    </div>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: interpolate(frame, [338, 372], [0, 620], {
          easing: EASE_OUT,
          ...CLAMP,
        }),
        height: 5,
        backgroundColor: COLORS.accent,
      }}
    />
  </div>
);

/**
 * The plan -> confirm -> apply flow, drawn by hand: `--dry-run` types out and
 * the plan cascades in, `--write` types out and the editor's specifiers flash
 * to their kebab names in lockstep with the terminal's rename lines. `offset`
 * shifts the clock so the one-frame hero still lands on the settled scene.
 */
const Scene: FC<{ offset?: number }> = ({ offset = 0 }) => {
  const frame = useCurrentFrame() + offset;

  return (
    <SceneBackground>
      <Header frame={frame} />
      <Terminal frame={frame} />
      <Editor frame={frame} />
      <CommitNote frame={frame} />
      <InstallCard frame={frame} />
      <Sparkle
        color={COLORS.success}
        delay={244 - offset}
        left={742}
        size={18}
        top={716}
      />
    </SceneBackground>
  );
};

/** Hero still for the README: the demo's settled final frame. */
export const CodemodsStill: FC = () => <Scene offset={384} />;

/** The README GIF: 450 frames at 30fps, shipped through the ffmpeg recipe. */
export const CodemodsDemo: FC = () => <Scene />;
