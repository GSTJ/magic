import type { ThemedToken } from "shiki";

import type { CSSProperties, FC } from "react";

import { COLORS } from "../brand";
import { FONTS } from "../fonts";
import { BrandMark, CodePane, SceneBackground, Tagline } from "../primitives";
import { useTokens } from "../shiki";

/**
 * Signature options only; the cards are a detail crop, not the full files.
 * Every value matches packages/tsconfig verbatim so the picture stays honest.
 */
const SNIPPETS = {
  base: [
    "{",
    '  "strict": true,',
    '  "noUncheckedIndexedAccess": true,',
    '  "moduleResolution": "Bundler"',
    "}",
  ].join("\n"),
  expo: [
    "{",
    '  "extends": "./base.json",',
    '  "jsx": "react-jsx",',
    '  "lib": ["ES2022", "DOM"]',
    "}",
  ].join("\n"),
  internalPackage: [
    "{",
    '  "extends": "./base.json",',
    '  "emitDeclarationOnly": true,',
    '  "declarationMap": true',
    "}",
  ].join("\n"),
  nextjs: [
    "{",
    '  "extends": "./base.json",',
    '  "jsx": "preserve",',
    '  "incremental": true',
    "}",
  ].join("\n"),
} as const;

/** Header 44 + CodePane padding 52 + five lines at 17px / 1.7 line height. */
const CARD_HEIGHT = 246;
const CHILD_TOP = 326;
const BASE_BOTTOM = CARD_HEIGHT;

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 22,
};

const TITLE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const NAME: CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 700,
  fontSize: 40,
  letterSpacing: -1.2,
  color: COLORS.fg,
};

/** Local coordinate space for the cards and the arrows between them. */
const DIAGRAM: CSSProperties = {
  position: "relative",
  width: 1312,
  height: 572,
};

const EXTENDS_LABEL: CSSProperties = {
  position: "absolute",
  left: 674,
  top: 266,
};

type CardSpec = {
  dot: string;
  left: number;
  lines: ThemedToken[][] | null;
  title: string;
};

const ConfigCard: FC<CardSpec & { top: number; width: number }> = ({
  dot,
  left,
  lines,
  title,
  top,
  width,
}) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width,
      height: CARD_HEIGHT,
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 14,
      boxShadow: `8px 10px 0 ${COLORS.shadow}`,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 44,
        padding: "0 20px",
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          backgroundColor: dot,
        }}
      />
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 16,
          letterSpacing: -0.2,
          color: COLORS.fgMuted,
        }}
      >
        {title}
      </div>
    </div>
    {lines === null ? null : (
      <CodePane fontSize={17} lines={lines} showLineNumbers={false} />
    )}
  </div>
);

/**
 * One lane per preset: the x where it leaves its card and the x where it
 * lands on `base.json`'s bottom edge. Curves and arrowheads derive from these.
 */
const ARROW_LANES: [number, number][] = [
  [200, 506],
  [656, 656],
  [1112, 806],
];

const ExtendsArrows: FC = () => (
  <svg
    style={{ position: "absolute", inset: 0, overflow: "visible" }}
    viewBox="0 0 1312 572"
  >
    {ARROW_LANES.map(([from, to]) => (
      <g key={from}>
        <path
          d={`M ${from} ${CHILD_TOP} C ${from} ${CHILD_TOP - 32}, ${to} ${CHILD_TOP - 20}, ${to} ${BASE_BOTTOM + 12}`}
          fill="none"
          stroke={COLORS.accent}
          strokeLinecap="round"
          strokeWidth={2.5}
        />
        <path
          d={`M ${to - 7} ${BASE_BOTTOM + 16} L ${to + 7} ${BASE_BOTTOM + 16} L ${to} ${BASE_BOTTOM} Z`}
          fill={COLORS.accent}
        />
      </g>
    ))}
  </svg>
);

/**
 * Hero still: `base.json` on top, the three presets underneath, and accent
 * arrows for the `extends` edges. Card bodies are shiki-tokenized JSON with
 * the published theme, so the colors are the theme's own.
 */
export const TsconfigStill: FC = () => {
  const base = useTokens(SNIPPETS.base, "json");
  const expo = useTokens(SNIPPETS.expo, "json");
  const internalPackage = useTokens(SNIPPETS.internalPackage, "json");
  const nextjs = useTokens(SNIPPETS.nextjs, "json");

  const presets: CardSpec[] = [
    {
      dot: COLORS.success,
      left: 0,
      lines: internalPackage,
      title: "internal-package.json",
    },
    { dot: COLORS.cyan, left: 456, lines: nextjs, title: "nextjs.json" },
    { dot: COLORS.pink, left: 912, lines: expo, title: "expo.json" },
  ];

  return (
    <SceneBackground>
      <div style={CENTERED}>
        <div style={TITLE_ROW}>
          <BrandMark size={44} />
          <div style={NAME}>magic-tsconfig</div>
        </div>
        <Tagline fontSize={26}>
          One strict base, three presets that extend it
        </Tagline>
        <div style={DIAGRAM}>
          <ExtendsArrows />
          <ConfigCard
            dot={COLORS.accent}
            left={421}
            lines={base}
            title="base.json"
            top={0}
            width={470}
          />
          {presets.map((card) => (
            <ConfigCard
              key={card.title}
              top={CHILD_TOP}
              width={400}
              {...card}
            />
          ))}
          <div style={EXTENDS_LABEL}>
            <Tagline color={COLORS.accent} fontSize={22}>
              extends
            </Tagline>
          </div>
        </div>
      </div>
    </SceneBackground>
  );
};
