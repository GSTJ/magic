import type { CSSProperties, FC } from "react";

import { COLORS } from "magic-video/brand";
import { FONTS } from "magic-video/fonts";
import {
  BrandMark,
  SceneBackground,
  WindowFrame,
} from "magic-video/primitives";

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 30,
};

const NAME: CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 700,
  fontSize: 60,
  letterSpacing: -2,
  color: COLORS.fg,
};

/**
 * The standard's anatomy, as placeholder shapes: greeked bars for prose, one
 * slab for the install command, real text only where the validator looks.
 */
const SECTIONS = [
  { bars: [560, 480], code: false, title: "## How it works" },
  { bars: [420], code: true, title: "## Install" },
  { bars: [360], code: false, title: "## FAQ" },
];

const BADGE_WIDTHS = [52, 64, 46, 56];

/** A line of greeked body text. */
const Bar: FC<{ width: number }> = ({ width }) => (
  <div
    style={{
      width,
      height: 12,
      borderRadius: 6,
      backgroundColor: COLORS.fgMuted,
      opacity: 0.3,
    }}
  />
);

/** The install command's fenced block, one shade off the window surface. */
const CodeBar: FC<{ width: number }> = ({ width }) => (
  <div
    style={{
      width,
      height: 26,
      borderRadius: 8,
      border: `1px solid ${COLORS.border}`,
      backgroundColor: COLORS.shadow,
    }}
  />
);

/** A section heading, highlighted: the sections are what the still is about. */
const Heading: FC<{ children: string }> = ({ children }) => (
  <div
    style={{
      alignSelf: "flex-start",
      marginTop: 8,
      padding: "5px 12px",
      borderRadius: 8,
      backgroundColor: `${COLORS.accent}1f`,
      fontFamily: FONTS.mono,
      fontSize: 19,
      letterSpacing: -0.3,
      color: COLORS.accent,
    }}
  >
    {children}
  </div>
);

/**
 * Final frame: a README skeleton with the standard's sections highlighted.
 * Hero image, centered tagline, badge row, then the required headings in the
 * theme's accent; everything that is prose stays greeked.
 */
export const ReadmeStill: FC = () => (
  <SceneBackground>
    <div style={CENTERED}>
      <BrandMark size={80} />
      <div style={NAME}>magic-readme</div>
      <WindowFrame height={500} title="README.md" width={880}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: "26px 40px",
          }}
        >
          <div
            style={{
              alignSelf: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 320,
              height: 84,
              borderRadius: 12,
              border: `1px solid ${COLORS.accent}55`,
              backgroundColor: `${COLORS.accent}12`,
            }}
          >
            <BrandMark size={36} />
          </div>
          <div style={{ alignSelf: "center" }}>
            <Bar width={300} />
          </div>
          <div style={{ alignSelf: "center", display: "flex", gap: 8 }}>
            {BADGE_WIDTHS.map((width) => (
              <div
                key={width}
                style={{
                  width,
                  height: 16,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.selection,
                }}
              />
            ))}
          </div>
          {SECTIONS.map(({ bars, code, title }) => (
            <div
              key={title}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <Heading>{title}</Heading>
              {bars.map((width) =>
                code ? (
                  <CodeBar key={width} width={width} />
                ) : (
                  <Bar key={width} width={width} />
                ),
              )}
            </div>
          ))}
        </div>
      </WindowFrame>
    </div>
  </SceneBackground>
);
