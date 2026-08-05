import type { FC } from "react";

import { CODE, COLORS } from "magic-video/brand";
import { FONTS } from "magic-video/fonts";
import {
  BrandMark,
  SceneBackground,
  Sparkle,
  Tagline,
} from "magic-video/primitives";

const CARD = { height: 140, width: 290 } as const;
const LAYER_STEP = 11;
const RADIUS = 14;

type Variant = {
  accent: string;
  caption: string;
  depth: number;
  name: string;
  x: number;
  y: number;
};

/**
 * One card per preset, left to right in extension order. `depth` is how many
 * presets sit underneath, drawn as offset slabs behind the card, so `expo`
 * visibly carries `react-native`, `react` and `base` on its back.
 */
const VARIANTS: Variant[] = [
  {
    accent: COLORS.accent,
    caption: "any TypeScript, no framework",
    depth: 0,
    name: "base",
    x: 110,
    y: 385,
  },
  {
    accent: COLORS.cyan,
    caption: "+ react, react-perf, jsx-a11y, safe-jsx",
    depth: 1,
    name: "react",
    x: 480,
    y: 385,
  },
  {
    accent: COLORS.pink,
    caption: "+ the react-native rules",
    depth: 2,
    name: "react-native",
    x: 850,
    y: 250,
  },
  {
    accent: COLORS.warning,
    caption: "+ the nextjs plugin",
    depth: 2,
    name: "next",
    x: 850,
    y: 520,
  },
  {
    accent: COLORS.success,
    caption: "+ expo-router carve-outs",
    depth: 3,
    name: "expo",
    x: 1220,
    y: 250,
  },
];

type EdgeTip = { x: number; y: number };

type Edge = { path: string; tip: EdgeTip };

/**
 * Elbow connectors between card edges. The `tip` dot sits just short of the
 * extending card's border so the card painted on top never covers it.
 */
const EDGES: Edge[] = [
  { path: "M400 455 H480", tip: { x: 472, y: 455 } },
  { path: "M770 455 H810 V320 H850", tip: { x: 842, y: 320 } },
  { path: "M770 455 H810 V590 H850", tip: { x: 842, y: 590 } },
  { path: "M1140 320 H1220", tip: { x: 1212, y: 320 } },
];

const EdgeLayer: FC = () => (
  <svg
    style={{ height: "100%", position: "absolute", width: "100%" }}
    viewBox="0 0 1600 900"
  >
    {EDGES.map((edge) => (
      <g key={edge.path}>
        <path
          d={edge.path}
          fill="none"
          stroke={COLORS.border}
          strokeWidth={2}
        />
        <circle
          cx={edge.tip.x}
          cy={edge.tip.y}
          fill={COLORS.accent}
          r={6}
          stroke={COLORS.canvas}
          strokeWidth={3}
        />
      </g>
    ))}
  </svg>
);

const VariantCard: FC<{ variant: Variant }> = ({ variant }) => (
  <>
    {Array.from({ length: variant.depth }, (_, index) => (
      <div
        key={index}
        style={{
          backgroundColor: COLORS.shadow,
          border: `1px solid ${COLORS.line}`,
          borderRadius: RADIUS,
          height: CARD.height,
          left: variant.x + (variant.depth - index) * LAYER_STEP,
          position: "absolute",
          top: variant.y + (variant.depth - index) * LAYER_STEP,
          width: CARD.width,
        }}
      />
    ))}
    <div
      style={{
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS,
        borderTop: `3px solid ${variant.accent}`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 9,
        height: CARD.height,
        justifyContent: "center",
        left: variant.x,
        padding: "0 28px",
        position: "absolute",
        top: variant.y,
        width: CARD.width,
      }}
    >
      <div
        style={{
          color: COLORS.fg,
          fontFamily: FONTS.mono,
          fontSize: 27,
          fontWeight: 700,
          letterSpacing: -0.6,
        }}
      >
        {variant.name}
      </div>
      <div
        style={{
          color: COLORS.fgMuted,
          fontFamily: FONTS.sans,
          fontSize: 18,
          letterSpacing: -0.2,
          lineHeight: 1.35,
        }}
      >
        {variant.caption}
      </div>
    </div>
  </>
);

const Header: FC = () => (
  <div
    style={{
      alignItems: "center",
      display: "flex",
      height: 96,
      justifyContent: "space-between",
      left: 80,
      position: "absolute",
      right: 80,
      top: 0,
    }}
  >
    <div
      style={{
        alignItems: "center",
        color: COLORS.fg,
        display: "flex",
        fontFamily: FONTS.sans,
        fontSize: 28,
        fontWeight: 700,
        gap: 16,
        letterSpacing: -0.8,
      }}
    >
      <BrandMark size={40} />
      magic-oxlint-config
    </div>
    <Tagline fontSize={25}>five variants, each building on the last</Tagline>
  </div>
);

/** The consumption line under the diagram: a whole config file in one line. */
const ConfigLine: FC = () => (
  <div
    style={{
      bottom: 84,
      display: "flex",
      fontFamily: FONTS.mono,
      fontSize: 25,
      justifyContent: "center",
      left: 0,
      letterSpacing: -0.5,
      position: "absolute",
      right: 0,
      whiteSpace: "pre",
    }}
  >
    <span style={{ color: CODE.comment }}>{"// oxlint.config.mts   "}</span>
    <span style={{ color: CODE.keyword }}>export</span>
    <span style={{ color: CODE.punctuation }}>{" { "}</span>
    <span style={{ color: CODE.keyword }}>default</span>
    <span style={{ color: CODE.punctuation }}>{" } "}</span>
    <span style={{ color: CODE.keyword }}>from</span>
    <span style={{ color: CODE.string }}>{' "magic-oxlint-config/react"'}</span>
    <span style={{ color: CODE.punctuation }}>;</span>
  </div>
);

/**
 * Hero still: the five presets as layered cards with edges tracing who
 * extends whom, base at the left, expo carrying the deepest stack.
 */
export const OxlintConfigStill: FC = () => (
  <SceneBackground>
    <Header />
    <EdgeLayer />
    {VARIANTS.map((variant) => (
      <VariantCard key={variant.name} variant={variant} />
    ))}
    <Sparkle
      color={COLORS.accent}
      delay={-20}
      left={1368}
      size={16}
      top={608}
    />
    <ConfigLine />
  </SceneBackground>
);
