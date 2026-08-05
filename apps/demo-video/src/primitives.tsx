import type { ThemedToken } from "shiki";

import type { CSSProperties, FC, ReactNode } from "react";

import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { CODE, COLORS } from "./brand";
import { FONTS } from "./fonts";

const SPARKLE_PATH =
  "M16 0C17.7 9.7 22.3 14.3 32 16C22.3 17.7 17.7 22.3 16 32C14.3 22.3 9.7 17.7 0 16C9.7 14.3 14.3 9.7 16 0Z";

const SPRING_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const OVERSHOOT = Easing.bezier(0.34, 1.35, 0.64, 1);

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/**
 * The four-point star every scene scatters around. Breathes over ~2 seconds
 * from `delay`; pass a negative delay to land a still mid-breath instead of
 * at the dim start of the cycle.
 */
export const Sparkle: FC<{
  color: string;
  delay?: number;
  left: number | string;
  size: number;
  top: number | string;
}> = ({ color, delay = 0, left, size, top }) => {
  const frame = useCurrentFrame();

  return (
    <svg
      viewBox="0 0 32 32"
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        overflow: "visible",
        opacity: interpolate(
          frame,
          [delay, delay + 12, delay + 46, delay + 62],
          [0.24, 0.9, 0.58, 0.24],
          { easing: SPRING_OUT, ...CLAMP },
        ),
        rotate: interpolate(frame, [delay, delay + 90], ["-8deg", "10deg"], {
          easing: SPRING_OUT,
          ...CLAMP,
        }),
        scale: interpolate(
          frame,
          [delay, delay + 18, delay + 46, delay + 62],
          [0.72, 1, 0.84, 0.72],
          { easing: OVERSHOOT, ...CLAMP },
        ),
      }}
    >
      <path d={SPARKLE_PATH} fill={color} />
    </svg>
  );
};

/**
 * The magic mark, inlined from `public/magic-mark.svg` so it stays vector at
 * any render size. Its colors are the brand's own and hold steady when the
 * theme changes; only the lift under it is themed.
 */
export const BrandMark: FC<{ size?: number }> = ({ size = 64 }) => (
  <svg
    fill="none"
    viewBox="0 0 48 48"
    style={{
      width: size,
      height: size,
      overflow: "visible",
      filter: `drop-shadow(0 ${size * 0.12}px ${size * 0.3}px ${COLORS.accent}44)`,
    }}
  >
    <rect fill="#151411" height="44" rx="13" width="44" x="2" y="2" />
    <path
      d="m23.5 6.5-4.2 14.1 10.1-5.1-5.9-9Z"
      fill="#9DF7C7"
      stroke="#151411"
      strokeLinejoin="round"
      strokeWidth="1.4"
    />
    <path
      d="M16.2 20.3c2.9-3.1 6.8-4.5 10.8-3.7 5.7 1.1 9.1 6.2 8 11.8-.9 4.7-5 8.1-9.9 8.1h-9.3c-1.6 0-2.8-1.3-2.8-2.8v-5.4c0-3 .9-5.8 3.2-8Z"
      fill="#FFFDF7"
    />
    <path
      d="m17.1 21.1-5.2-3.4 1.2 7.1"
      fill="#FF4FA3"
      stroke="#151411"
      strokeLinejoin="round"
      strokeWidth="1.4"
    />
    <path
      d="M16.1 22.1c-2.3 2.3-3.4 5.2-3.1 8.9l4.7-2.2-2.1 5.3 5-1.6-1.1 4h5.6c-4-4.2-3.7-10.6-9-14.4Z"
      fill="#7C5CFF"
    />
    <circle cx="29.8" cy="24.8" fill="#151411" r="1.35" />
    <path
      d="M39 7.5c.45 2.55 1.95 4.05 4.5 4.5-2.55.45-4.05 1.95-4.5 4.5-.45-2.55-1.95-4.05-4.5-4.5 2.55-.45 4.05-1.95 4.5-4.5Z"
      fill="#FF4FA3"
    />
    <path
      d="M38.2 28.8c.28 1.6 1.2 2.52 2.8 2.8-1.6.28-2.52 1.2-2.8 2.8-.28-1.6-1.2-2.52-2.8-2.8 1.6-.28 2.52-1.2 2.8-2.8Z"
      fill="#9DF7C7"
    />
  </svg>
);

/**
 * Editor or terminal chrome: traffic lights, a mono title, and a body slab on
 * the theme's editor background. The lights borrow the theme's error, warning
 * and success roles, which is what a themed terminal does with them anyway.
 */
export const WindowFrame: FC<{
  children?: ReactNode;
  height: number;
  style?: CSSProperties;
  title: string;
  width: number;
}> = ({ children, height, style, title, width }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 14,
      boxShadow: `12px 14px 0 ${COLORS.shadow}`,
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
        padding: "0 22px",
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div style={{ display: "flex", gap: 9 }}>
        {[COLORS.error, COLORS.warning, COLORS.success].map((light) => (
          <div
            key={light}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: light,
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 17,
          letterSpacing: -0.2,
          color: COLORS.fgMuted,
        }}
      >
        {title}
      </div>
    </div>
    <div style={{ position: "relative", height: height - 53 }}>{children}</div>
  </div>
);

/**
 * Renders shiki output: one span per token, colored by the theme grammar.
 * Takes pre-tokenized lines because tokenizing is async; pair it with
 * `useTokens` from `./shiki`.
 */
export const CodePane: FC<{
  fontSize?: number;
  lines: ThemedToken[][];
  showLineNumbers?: boolean;
}> = ({ fontSize = 24, lines, showLineNumbers = true }) => (
  <div
    style={{
      display: "flex",
      gap: 26,
      padding: "26px 32px",
      fontFamily: FONTS.mono,
      fontSize,
      lineHeight: 1.7,
      letterSpacing: -0.4,
      whiteSpace: "pre",
    }}
  >
    {showLineNumbers ? (
      <div style={{ color: COLORS.fgMuted, opacity: 0.55, textAlign: "right" }}>
        {lines.map((_, lineIndex) => (
          <div key={lineIndex}>{String(lineIndex + 1).padStart(2, "0")}</div>
        ))}
      </div>
    ) : null}
    <div style={{ color: CODE.fg }}>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex}>
          {line.length === 0
            ? " "
            : line.map((token, tokenIndex) => (
                <span
                  key={tokenIndex}
                  style={{ color: token.color ?? CODE.fg }}
                >
                  {token.content}
                </span>
              ))}
        </div>
      ))}
    </div>
  </div>
);

/**
 * One muted line for asides. Sits below a heading or a mark, so it stays
 * lighter and tighter than the sans headings around it.
 */
export const Tagline: FC<{
  children: ReactNode;
  color?: string;
  fontSize?: number;
}> = ({ children, color = COLORS.fgMuted, fontSize = 30 }) => (
  <div
    style={{
      fontFamily: FONTS.sans,
      fontWeight: 400,
      fontSize,
      letterSpacing: -0.6,
      color,
    }}
  >
    {children}
  </div>
);

/**
 * Every scene's floor: the darkened canvas, four hairline rules framing the
 * stage, and a field of sparkles. The first sparkle starts mid-breath so
 * stills rendered at frame 0 catch it lit.
 */
export const SceneBackground: FC<{ children?: ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: COLORS.canvas, overflow: "hidden" }}>
    <div
      style={{
        position: "absolute",
        left: 48,
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: COLORS.line,
      }}
    />
    <div
      style={{
        position: "absolute",
        right: 48,
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: COLORS.line,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 96,
        height: 1,
        backgroundColor: COLORS.line,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 54,
        height: 1,
        backgroundColor: COLORS.line,
      }}
    />
    <Sparkle color={COLORS.accent} delay={-14} left="94%" size={20} top="9%" />
    <Sparkle color={COLORS.cyan} delay={24} left="49%" size={11} top="11%" />
    <Sparkle color={COLORS.pink} delay={42} left="2.5%" size={14} top="86%" />
    {children}
  </AbsoluteFill>
);
