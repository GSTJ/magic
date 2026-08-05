import type { CSSProperties, FC, ReactNode } from "react";

import { CODE, COLORS } from "../brand";
import { FONTS } from "../fonts";
import { BrandMark, SceneBackground, WindowFrame } from "../primitives";

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 36,
};

const NAME: CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 700,
  fontSize: 64,
  letterSpacing: -2,
  color: COLORS.fg,
};

/**
 * Hand-built spans rather than shiki: the scene is the diagnostic, and the
 * squiggle plus the inline rule id have to wrap exact token runs, which
 * tokenized output can't do without pixel measurement. Colors still come from
 * the theme's own `tokenColors` through the CODE map, so the pane matches a
 * real editor. The snippet is the `// reported` example from the rule's own
 * README section.
 */
const MONO: CSSProperties = {
  fontFamily: FONTS.mono,
  fontSize: 24,
  lineHeight: 1.7,
  letterSpacing: -0.4,
  whiteSpace: "pre",
};

const SQUIGGLE: CSSProperties = {
  textDecorationLine: "underline",
  textDecorationStyle: "wavy",
  textDecorationColor: COLORS.error,
  textDecorationThickness: 2,
  textUnderlineOffset: 8,
};

/** Error-lens style inline tag at the end of the flagged line. */
const RULE_TAG: CSSProperties = {
  marginLeft: 20,
  padding: "3px 12px",
  borderRadius: 6,
  backgroundColor: `${COLORS.error}22`,
  color: COLORS.error,
  fontSize: 19,
};

const FLAGGED_LINE = 2;
const LINE_NUMBERS = [1, 2, 3, 4, 5, 6];

/** The gutter: muted line numbers, with the flagged line lit in error red. */
const Gutter: FC = () => (
  <div style={{ ...MONO, textAlign: "right" }}>
    {LINE_NUMBERS.map((line) => (
      <div
        key={line}
        style={
          line === FLAGGED_LINE
            ? { color: COLORS.error }
            : { color: COLORS.fgMuted, opacity: 0.55 }
        }
      >
        {String(line).padStart(2, "0")}
      </div>
    ))}
  </div>
);

const Snippet: FC = () => (
  <div style={{ ...MONO, color: CODE.fg }}>
    <div>
      <span style={{ color: CODE.keyword }}>const </span>
      handle
      <span style={{ color: CODE.operator }}> = </span>
      <span style={{ color: CODE.punctuation }}>(</span>
      <span style={{ color: CODE.parameter }}>ok</span>
      <span style={{ color: CODE.punctuation }}>: </span>
      <span style={{ color: CODE.type }}>boolean</span>
      <span style={{ color: CODE.punctuation }}>)</span>
      <span style={{ color: CODE.operator }}> {"=>"} </span>
      <span style={{ color: CODE.punctuation }}>{"{"}</span>
    </div>
    <div>
      {"  "}
      <span style={SQUIGGLE}>
        <span style={{ color: CODE.keyword }}>if </span>
        <span style={{ color: CODE.punctuation }}>(</span>
        ok
        <span style={{ color: CODE.punctuation }}>) {"{"}</span>
      </span>
      <span style={RULE_TAG}>magic/prefer-early-return</span>
    </div>
    <div>
      {"    "}
      <span style={{ color: CODE.fn }}>doA</span>
      <span style={{ color: CODE.punctuation }}>();</span>
    </div>
    <div>
      {"    "}
      <span style={{ color: CODE.fn }}>doB</span>
      <span style={{ color: CODE.punctuation }}>();</span>
    </div>
    <div>
      {"  "}
      <span style={{ color: CODE.punctuation }}>{"}"}</span>
    </div>
    <div>
      <span style={{ color: CODE.punctuation }}>{"};"}</span>
    </div>
  </div>
);

/** The problems strip under the code, quoting the rule's real message. */
const Diagnostic: FC<{ children: ReactNode }> = ({ children }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: 32,
        right: 32,
        bottom: 62,
        height: 1,
        backgroundColor: COLORS.border,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 32,
        bottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 13,
        fontFamily: FONTS.mono,
        fontSize: 18,
        letterSpacing: -0.2,
        color: COLORS.fgMuted,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: COLORS.error,
        }}
      />
      {children}
    </div>
  </>
);

/** Hero still: a code pane with `magic/prefer-early-return` firing. */
export const OxlintPluginStill: FC = () => (
  <SceneBackground>
    <div style={{ ...CENTERED, gap: 32 }}>
      <BrandMark size={96} />
      <div style={NAME}>magic-oxlint-plugin</div>
      <WindowFrame height={440} title="handlers.ts" width={920}>
        <div style={{ display: "flex", gap: 26, padding: "24px 32px" }}>
          <Gutter />
          <Snippet />
        </div>
        <Diagnostic>
          Prefer an early return to wrapping the whole function body in an if.
        </Diagnostic>
      </WindowFrame>
    </div>
  </SceneBackground>
);
