import type { ThemedToken } from "shiki";

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
import { useTokens } from "../shiki";

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
 * A whole life for a scene the tour later clears: in at `cue[0]` drifting from
 * `from`, out at `cue[1]` drifting to `to`. One interpolate per property across
 * all four stops, so nothing snaps between the halves.
 *
 * The fades are 10 frames rather than the 16 the entrances use, and the cues
 * below never overlap. Two of these scenes are centered windows, and a long
 * dissolve between two windows at the same place reads as one broken panel
 * rather than a cut.
 */
const life = (
  frame: number,
  cue: readonly [number, number],
  from: string,
  to: string,
): CSSProperties => ({
  opacity: interpolate(
    frame,
    [cue[0], cue[0] + 11, cue[1], cue[1] + 10],
    [0, 1, 1, 0],
    { easing: EASE_OUT, ...CLAMP },
  ),
  translate: interpolate(
    frame,
    [cue[0], cue[0] + 13, cue[1], cue[1] + 12],
    [from, "0px 0px", "0px 0px", to],
    { easing: EASE_OUT, ...CLAMP },
  ),
});

/**
 * Every stage's in and out frame, so the tour's rhythm is readable in one place
 * instead of scattered across a dozen interpolate calls. 450 frames at 30fps:
 * mark, the file fixing itself, CI going green, the palette, the closing card.
 */
const CUE = {
  checks: [206, 292],
  closing: [378, 448],
  editor: [76, 194],
  header: [74, 362],
  intro: [4, 62],
  palette: [304, 366],
} as const;

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 26,
};

const WORDMARK: CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 800,
  letterSpacing: -4,
  color: COLORS.fg,
};

const MONO_NOTE: CSSProperties = {
  fontFamily: FONTS.mono,
  fontSize: 19,
  letterSpacing: -0.2,
  color: COLORS.fgMuted,
};

/**
 * The file as a hand leaves it: no semicolons, spacing wherever the keys fell,
 * a `let` that is never reassigned, and imports in the order they were needed
 * rather than the order the config sorts them into.
 */
const MESSY = [
  'import {config} from "./config"',
  'import {readFile} from "node:fs/promises"',
  'import {parse} from "yaml"',
  "export const load = async ( file:string ) => {",
  'let raw = await readFile( file,"utf8" )',
  "return parse(raw,config)",
  "}",
].join("\n");

/**
 * The same file after `oxlint --fix` and `oxfmt`: `prefer-const` applied, house
 * style restored, and the imports in the published group order, builtin first,
 * then external, then relative, with the blank line between groups that
 * `newlinesBetween` puts there.
 */
const CLEAN = [
  'import { readFile } from "node:fs/promises";',
  "",
  'import { parse } from "yaml";',
  "",
  'import { config } from "./config";',
  "",
  "export const load = async (file: string) => {",
  '  const raw = await readFile(file, "utf8");',
  "  return parse(raw, config);",
  "};",
].join("\n");

/**
 * Where each authored line starts and where the tools land it. The two import
 * moves are the whole point of the beat: `./config` falls from the top of the
 * file to the bottom of the import block while `node:fs/promises` climbs past
 * it, which is what sorting looks like when you watch it happen.
 */
const ROWS = [
  { after: 4, before: 0 },
  { after: 0, before: 1 },
  { after: 2, before: 2 },
  { after: 6, before: 3 },
  { after: 7, before: 4 },
  { after: 8, before: 5 },
  { after: 9, before: 6 },
] as const;

const ROW_HEIGHT = 44;
const SLOT_COUNT = 10;

/** First row swaps here; the rest follow one every six frames, top to bottom. */
const FIX_AT = 132;
const FIX_STEP = 6;

const swapFrame = (index: number): number => FIX_AT + index * FIX_STEP;

/**
 * One line of the file, living at a slot rather than in a flow, so it can glide
 * to the slot the sorter gives it while its own text swaps underneath a
 * selection flash. Both halves are real shiki output, tokenized from the two
 * sources above, so the colors are the published theme's either way.
 */
const FixRow: FC<{
  after: ThemedToken[];
  afterSlot: number;
  at: number;
  before: ThemedToken[];
  beforeSlot: number;
  frame: number;
}> = ({ after, afterSlot, at, before, beforeSlot, frame }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: interpolate(
        frame,
        [at, at + 16],
        [beforeSlot * ROW_HEIGHT, afterSlot * ROW_HEIGHT],
        { easing: EASE_OUT, ...CLAMP },
      ),
      whiteSpace: "pre",
    }}
  >
    <span
      style={{
        position: "absolute",
        inset: "3px -9px",
        borderRadius: 6,
        backgroundColor: COLORS.selection,
        opacity: interpolate(
          frame,
          [at - 5, at + 2, at + 13, at + 24],
          [0, 0.85, 0.85, 0],
          CLAMP,
        ),
      }}
    />
    <span style={{ position: "relative" }}>
      {(frame < at + 3 ? before : after).map((token, index) => (
        <span key={index} style={{ color: token.color ?? CODE.fg }}>
          {token.content}
        </span>
      ))}
    </span>
  </div>
);

/**
 * The tool that just ran, named. Unlit it is a muted pill; at `at` the border,
 * the label and a check all take the success role, which is the only signal in
 * the frame that says the change was a fix rather than an edit.
 */
const ToolChip: FC<{ at: number; frame: number; label: string }> = ({
  at,
  frame,
  label,
}) => {
  const lit = interpolate(frame, [at, at + 12], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 20px",
        borderRadius: 9,
        border: `1px solid ${lit > 0.5 ? COLORS.success : COLORS.border}`,
        backgroundColor: COLORS.surface,
        fontFamily: FONTS.mono,
        fontSize: 20,
        letterSpacing: -0.3,
        color: lit > 0.5 ? COLORS.fg : COLORS.fgMuted,
      }}
    >
      <svg
        fill="none"
        viewBox="0 0 24 24"
        style={{ width: 18, height: 18, opacity: lit, scale: lit }}
      >
        <path
          d="M5 12.6 9.8 17.4 19 8"
          stroke={COLORS.success}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.4}
        />
      </svg>
      {label}
    </div>
  );
};

/**
 * The editor beat: a file that fixes itself. Nothing types, because nobody
 * types a format run; the lines move and settle the way they do when the
 * pre-commit hook lands.
 */
const Editor: FC<{ frame: number }> = ({ frame }) => {
  const messy = useTokens(MESSY, "tsx");
  const clean = useTokens(CLEAN, "tsx");
  const grown = interpolate(frame, [FIX_AT, FIX_AT + 30], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        ...life(frame, CUE.editor, "0px 28px", "0px -34px"),
      }}
    >
      <WindowFrame
        height={572}
        style={{ position: "absolute", left: 300, top: 176 }}
        title="load-config.ts"
        width={1000}
      >
        <div
          style={{
            position: "relative",
            height: SLOT_COUNT * ROW_HEIGHT,
            margin: "30px 34px",
            fontFamily: FONTS.mono,
            fontSize: 26,
            lineHeight: `${ROW_HEIGHT}px`,
            letterSpacing: -0.4,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              width: 46,
              textAlign: "right",
              color: COLORS.fgMuted,
              opacity: 0.55,
            }}
          >
            {Array.from({ length: SLOT_COUNT }, (_, slot) => (
              <div
                key={slot}
                // The file grows by three blank lines, so the gutter grows too.
                style={{ opacity: slot < ROWS.length ? 1 : grown }}
              >
                {String(slot + 1).padStart(2, "0")}
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", left: 82, right: 0, top: 0 }}>
            {messy === null || clean === null
              ? null
              : ROWS.map((row, index) => (
                  <FixRow
                    after={clean[row.after] ?? []}
                    afterSlot={row.after}
                    at={swapFrame(index)}
                    before={messy[row.before] ?? []}
                    beforeSlot={row.before}
                    frame={frame}
                    key={row.before}
                  />
                ))}
          </div>
        </div>
      </WindowFrame>
      <div
        style={{
          position: "absolute",
          left: 300,
          top: 778,
          width: 1000,
          display: "flex",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <ToolChip at={FIX_AT} frame={frame} label="oxlint --fix" />
        <ToolChip
          at={FIX_AT + 24}
          frame={frame}
          label="oxfmt, imports sorted"
        />
      </div>
    </div>
  );
};

/**
 * The steps `.github/workflows/ci.yml` runs, in the order the reusable job runs
 * them. Times are the shape of a real run rather than a promise: the point of
 * the beat is that every repo gets this same row without writing it.
 */
const CHECKS = [
  { at: 230, name: "Build", time: "1m 04s" },
  { at: 237, name: "Lint", time: "11s" },
  { at: 244, name: "Format", time: "6s" },
  { at: 251, name: "Typecheck", time: "22s" },
  { at: 258, name: "Test", time: "34s" },
] as const;

/**
 * A check going from queued to green. The pending ring is a dashed circle that
 * keeps turning, so the row reads as working rather than broken while it waits;
 * at `at` it drops out and the tick springs in over it.
 */
const CheckRow: FC<{
  at: number;
  frame: number;
  index: number;
  name: string;
  time: string;
}> = ({ at, frame, index, name, time }) => {
  const done = interpolate(frame, [at, at + 11], [0, 1], {
    easing: OVERSHOOT,
    ...CLAMP,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        height: 62,
        borderBottom: `1px solid ${COLORS.border}`,
        ...enter(frame, 208 + index * 4, "0px 14px"),
      }}
    >
      <div style={{ position: "relative", width: 28, height: 28 }}>
        <svg
          fill="none"
          viewBox="0 0 24 24"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 1 - done,
            rotate: `${(frame % 60) * 6}deg`,
          }}
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke={COLORS.warning}
            strokeDasharray="4 5"
            strokeLinecap="round"
            strokeWidth={2.2}
          />
        </svg>
        <svg
          fill="none"
          viewBox="0 0 24 24"
          style={{ position: "absolute", inset: 0, opacity: done, scale: done }}
        >
          <circle cx="12" cy="12" fill={COLORS.success} r="10" />
          <path
            d="M7.4 12.4 10.6 15.5 16.6 9"
            stroke={COLORS.surface}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.4}
          />
        </svg>
      </div>
      <div
        style={{
          flex: 1,
          fontFamily: FONTS.sans,
          fontWeight: 600,
          fontSize: 25,
          letterSpacing: -0.5,
          color: done > 0.5 ? COLORS.fg : COLORS.fgMuted,
        }}
      >
        {name}
      </div>
      <div style={{ ...MONO_NOTE, fontSize: 18 }}>{time}</div>
    </div>
  );
};

const Checks: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      ...life(frame, CUE.checks, "0px 30px", "0px -30px"),
    }}
  >
    <WindowFrame
      height={520}
      style={{ position: "absolute", left: 370, top: 196 }}
      title="ci.yml"
      width={860}
    >
      <div style={{ padding: "24px 34px" }}>
        <div style={{ ...MONO_NOTE, fontSize: 17, marginBottom: 10 }}>
          GSTJ/magic/.github/workflows/ci.yml@v1
        </div>
        {CHECKS.map((check, index) => (
          <CheckRow
            at={check.at}
            frame={frame}
            index={index}
            key={check.name}
            name={check.name}
            time={check.time}
          />
        ))}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            paddingTop: 22,
            fontFamily: FONTS.sans,
            fontWeight: 600,
            fontSize: 25,
            letterSpacing: -0.5,
            color: COLORS.success,
            ...enter(frame, 266, "0px 12px"),
          }}
        >
          <svg
            fill="none"
            viewBox="0 0 24 24"
            style={{ width: 24, height: 24 }}
          >
            <circle cx="12" cy="12" fill={COLORS.success} r="10" />
            <path
              d="M7.4 12.4 10.6 15.5 16.6 9"
              stroke={COLORS.surface}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.4}
            />
          </svg>
          All checks have passed
        </div>
      </div>
    </WindowFrame>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 748,
        textAlign: "center",
        ...enter(frame, 272, "0px 12px"),
      }}
    >
      <Tagline fontSize={25}>
        One reusable workflow, consumed by tag. Fix it here, every repo runs the
        fix.
      </Tagline>
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

const COLUMN_WIDTH = 196;
const COLUMN_HEIGHT = 292;

const LABEL: CSSProperties = {
  fontFamily: FONTS.mono,
  fontSize: 17,
  letterSpacing: -0.2,
  color: COLORS.fgMuted,
};

/**
 * The palette beat: each role fills its column from the floor up, one after the
 * next left to right, so the theme washes across the stage instead of being
 * dealt out as swatches. The ansi row underneath is the same 16 slots a themed
 * terminal gets.
 */
const Palette: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      ...life(frame, CUE.palette, "0px 26px", "0px -26px"),
    }}
  >
    <div style={{ ...LABEL, position: "absolute", left: 157, top: 196 }}>
      roles
    </div>
    <div
      style={{
        position: "absolute",
        left: 157,
        top: 228,
        display: "flex",
        gap: 22,
      }}
    >
      {ROLES.map(([label, value], index) => (
        <div key={label}>
          <div
            style={{
              position: "relative",
              width: COLUMN_WIDTH,
              height: COLUMN_HEIGHT,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.surface,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: interpolate(
                  frame,
                  [304 + index * 4, 332 + index * 4],
                  [0, COLUMN_HEIGHT],
                  { easing: EASE_OUT, ...CLAMP },
                ),
                backgroundColor: value,
              }}
            />
          </div>
          <div style={{ ...LABEL, marginTop: 12 }}>{label}</div>
        </div>
      ))}
    </div>
    <div style={{ ...LABEL, position: "absolute", left: 157, top: 604 }}>
      ansi 0-15
    </div>
    <div
      style={{
        position: "absolute",
        left: 157,
        top: 636,
        display: "flex",
        gap: 9,
      }}
    >
      {COLORS.ansi.map((swatch, index) => (
        <div
          key={index}
          style={{
            width: 71,
            height: 46,
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            backgroundColor: swatch,
            ...enter(frame, 318 + index * 2, "0px 14px"),
          }}
        />
      ))}
    </div>
    <div
      style={{
        position: "absolute",
        left: 157,
        top: 716,
        ...enter(frame, 330, "0px 12px"),
      }}
    >
      <Tagline fontSize={25}>
        One palette, ported to every editor and terminal the theme covers
      </Tagline>
    </div>
  </div>
);

const Intro: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      ...CENTERED,
      gap: 22,
      ...life(frame, CUE.intro, "0px 24px", "0px -38px"),
    }}
  >
    <div
      style={{
        scale: interpolate(frame, [6, 34], [0.7, 1], {
          easing: OVERSHOOT,
          ...CLAMP,
        }),
      }}
    >
      <BrandMark size={108} />
    </div>
    <div
      style={{ ...WORDMARK, fontSize: 104, ...enter(frame, 18, "0px 18px") }}
    >
      magic
    </div>
    <div style={enter(frame, 30, "0px 14px")}>
      <Tagline fontSize={27}>lint, format, types, CI, theme</Tagline>
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
      magic
    </div>
    <div style={MONO_NOTE}>one repo of configs, every project downstream</div>
  </div>
);

const Closing: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      ...CENTERED,
      gap: 24,
      ...life(frame, CUE.closing, "0px 26px", "0px 0px"),
    }}
  >
    <div
      style={{
        scale: interpolate(frame, [380, 408], [0.78, 1], {
          easing: OVERSHOOT,
          ...CLAMP,
        }),
      }}
    >
      <BrandMark size={92} />
    </div>
    <div
      style={{ ...WORDMARK, fontSize: 96, ...enter(frame, 392, "0px 16px") }}
    >
      magic
    </div>
    <div style={enter(frame, 402, "0px 14px")}>
      <Tagline fontSize={32}>Change it once. Every repo gets it.</Tagline>
    </div>
    <div style={{ ...MONO_NOTE, ...enter(frame, 414, "0px 12px") }}>
      github.com/GSTJ/magic
    </div>
  </div>
);

/**
 * The repo's own tour, 450 frames at 30fps: the mark and the wordmark, a file
 * that lints and formats itself while its imports resort, the CI row every
 * consumer inherits going green, the theme washing across the stage, and the
 * sentence the whole monorepo exists to make true. Sparkles fire on the cuts so
 * a transition has something moving in it besides the panel that is leaving.
 */
export const MagicDemo: FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneBackground>
      <Intro frame={frame} />
      <Header frame={frame} />
      <Editor frame={frame} />
      <Checks frame={frame} />
      <Palette frame={frame} />
      <Closing frame={frame} />
      <Sparkle color={COLORS.pink} delay={10} left="52%" size={19} top="86%" />
      <Sparkle color={COLORS.cyan} delay={82} left="5%" size={16} top="14%" />
      <Sparkle
        color={COLORS.success}
        delay={212}
        left="95.5%"
        size={21}
        top="66%"
      />
      <Sparkle
        color={COLORS.accent}
        delay={310}
        left="3%"
        size={17}
        top="28%"
      />
      <Sparkle color={COLORS.pink} delay={386} left="93%" size={20} top="22%" />
    </SceneBackground>
  );
};
