import type { CSSProperties, FC } from "react";

import { COLORS } from "magic-video/brand";
import { FONTS } from "magic-video/fonts";
import {
  BrandMark,
  CodePane,
  SceneBackground,
  Tagline,
  WindowFrame,
} from "magic-video/primitives";
import { useTokens } from "magic-video/shiki";

/**
 * The same seven imports twice: authored in a scramble on the left, after one
 * oxfmt run on the right. Every difference the frame shows is something the
 * config actually does: double quotes, semicolons, bracket spacing, and the
 * group order with a blank line between groups.
 */
const BEFORE = [
  "import {z} from 'zod'",
  "import styles from './profile.css'",
  "import Link from 'next/link'",
  'import {Avatar} from "./avatar"',
  "import { readFileSync } from 'node:fs'",
  "import { useState } from 'react'",
  "import type { User } from '~/types'",
].join("\n");

/** Kept as lines so the highlight below can find its row instead of hardcoding it. */
const AFTER_LINES = [
  'import type { User } from "~/types";',
  "",
  'import { readFileSync } from "node:fs";',
  "",
  'import { useState } from "react";',
  "",
  'import Link from "next/link";',
  "",
  'import { z } from "zod";',
  "",
  'import { Avatar } from "./avatar";',
  "",
  'import styles from "./profile.css";',
];

const AFTER = AFTER_LINES.join("\n");

/** CodePane geometry: 26px top padding, and fontSize 20 at line-height 1.7 is a 34px row. */
const FONT_SIZE = 20;
const ROW_HEIGHT = FONT_SIZE * 1.7;
const PANE_PADDING_TOP = 26;

const REACT_LINE = AFTER_LINES.indexOf('import { useState } from "react";');

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
};

const HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
};

const NAME: CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 700,
  fontSize: 42,
  letterSpacing: -1.4,
  color: COLORS.fg,
};

const PANES: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 28,
};

/** The line that carries a file from left to right, borrowed from the codemods tether. */
const TETHER: CSSProperties = {
  position: "relative",
  width: 56,
  height: 3,
  backgroundColor: COLORS.accent,
};

const TETHER_DOT: CSSProperties = {
  position: "absolute",
  right: -6,
  top: -5,
  width: 13,
  height: 13,
  borderRadius: 99,
  backgroundColor: COLORS.accent,
  border: `3px solid ${COLORS.canvas}`,
};

/**
 * An editor's line-highlight treatment for one sorted group. Positioned, so it
 * paints over the pane; 12% accent keeps the tokens legible under the band.
 */
const HIGHLIGHT: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: PANE_PADDING_TOP + REACT_LINE * ROW_HEIGHT,
  height: ROW_HEIGHT,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingRight: 18,
  backgroundColor: `${COLORS.accent}1f`,
  borderLeft: `3px solid ${COLORS.accent}`,
};

const GROUP_LABEL: CSSProperties = {
  fontFamily: FONTS.mono,
  fontSize: 15,
  letterSpacing: -0.2,
  color: COLORS.accent,
};

/**
 * Hero still: before and after panes of the same file, one oxfmt run apart.
 * Both panes tokenize through shiki with the published theme grammar, and the
 * react import group wears a band so the sort reads as groups.
 */
export const OxfmtStill: FC = () => {
  const before = useTokens(BEFORE, "typescript");
  const after = useTokens(AFTER, "typescript");

  return (
    <SceneBackground>
      <div style={CENTERED}>
        <div style={HEADER}>
          <BrandMark size={44} />
          <div style={NAME}>magic-oxfmt-config</div>
        </div>
        {before === null || after === null ? null : (
          <div style={PANES}>
            <WindowFrame height={560} title="before" width={620}>
              <CodePane fontSize={FONT_SIZE} lines={before} />
            </WindowFrame>
            <div style={TETHER}>
              <div style={TETHER_DOT} />
            </div>
            <WindowFrame height={560} title="after oxfmt" width={620}>
              <div style={HIGHLIGHT}>
                <div style={GROUP_LABEL}>group: react</div>
              </div>
              <CodePane fontSize={FONT_SIZE} lines={after} />
            </WindowFrame>
          </div>
        )}
        <Tagline>formatted and sorted in one pass</Tagline>
      </div>
    </SceneBackground>
  );
};
