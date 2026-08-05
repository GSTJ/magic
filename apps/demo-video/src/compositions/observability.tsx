import type { CSSProperties, FC } from "react";

import { CODE, COLORS } from "../brand";
import { FONTS } from "../fonts";
import {
  BrandMark,
  SceneBackground,
  Tagline,
  WindowFrame,
} from "../primitives";

const MONO: CSSProperties = {
  fontFamily: FONTS.mono,
  letterSpacing: -0.4,
};

/** Package name and tagline in the band above the stage's top rule. */
const Header: FC = () => (
  <div
    style={{
      position: "absolute",
      left: 80,
      right: 80,
      top: 0,
      height: 96,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
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
      <BrandMark size={40} />
      magic-observability
    </div>
    <Tagline fontSize={24}>one captureError shape, every platform</Tagline>
  </div>
);

/**
 * The app mid-incident: a render threw, the boundary rendered its fallback,
 * and the window is still standing. The caught error sits in a banner styled
 * like a dev overlay; the component that did the catching is named at the
 * bottom so the still reads without a caption.
 */
const BoundaryWindow: FC = () => (
  <WindowFrame
    height={560}
    style={{ position: "absolute", left: 90, top: 170 }}
    title="localhost:3000/checkout"
    width={620}
  >
    <div
      style={{
        margin: 24,
        padding: "16px 20px",
        borderLeft: `3px solid ${COLORS.error}`,
        borderRadius: 6,
        backgroundColor: `${COLORS.error}1f`,
        ...MONO,
      }}
    >
      <div style={{ fontSize: 18, color: COLORS.error }}>
        Error: card declined
      </div>
      <div style={{ marginTop: 6, fontSize: 15, color: COLORS.fgMuted }}>
        at confirmPayment (checkout.tsx:42)
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 168,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 26,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: -1,
          color: COLORS.fg,
        }}
      >
        Something went wrong.
      </div>
      <div
        style={{
          padding: "12px 30px",
          borderRadius: 10,
          border: `1px solid ${COLORS.accent}`,
          fontFamily: FONTS.sans,
          fontWeight: 600,
          fontSize: 21,
          color: COLORS.accent,
        }}
      >
        Try again
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        left: 24,
        right: 24,
        bottom: 22,
        paddingTop: 18,
        borderTop: `1px solid ${COLORS.border}`,
        whiteSpace: "pre",
        fontSize: 15,
        color: COLORS.fgMuted,
        ...MONO,
      }}
    >
      {"<ObservabilityBoundary client={client} fallback={ErrorScreen}>"}
    </div>
  </WindowFrame>
);

/** The caught error leaving the window for the card. */
const Tether: FC = () => (
  <div
    style={{
      position: "absolute",
      left: 710,
      top: 448,
      width: 96,
      height: 3,
      backgroundColor: COLORS.error,
    }}
  >
    <div
      style={{
        position: "absolute",
        right: -7,
        top: -6,
        width: 15,
        height: 15,
        borderRadius: 99,
        backgroundColor: COLORS.error,
        border: `3px solid ${COLORS.canvas}`,
      }}
    />
  </div>
);

/** Dotted keys the call below flattens to; values keep the string color. */
const LANDED: [string, string][] = [
  ["$exception_message", '"card declined"'],
  ["screen", '"checkout"'],
  ["request.path", '"/checkout"'],
];

/**
 * The captureError shape: the call as written, a rule, and the flattened
 * properties that land in PostHog. Hand-colored spans through the theme's
 * CODE map; this text never passes through a grammar.
 */
const ShapeCard: FC = () => (
  <div
    style={{
      position: "absolute",
      left: 806,
      top: 208,
      width: 704,
      padding: "38px 46px",
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 14,
      boxShadow: `12px 14px 0 ${COLORS.shadow}`,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 18,
        color: COLORS.error,
        ...MONO,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 99,
          backgroundColor: COLORS.error,
        }}
      />
      exception event
    </div>

    <div
      style={{
        marginTop: 26,
        fontSize: 24,
        lineHeight: 1.7,
        whiteSpace: "pre",
        color: CODE.fg,
        ...MONO,
      }}
    >
      <div>
        <span style={{ color: CODE.fn }}>captureError</span>
        <span style={{ color: CODE.punctuation }}>(</span>
        error
        <span style={{ color: CODE.punctuation }}>{", {"}</span>
      </div>
      <div>
        {"  "}
        <span style={{ color: CODE.parameter }}>screen</span>
        <span style={{ color: CODE.punctuation }}>: </span>
        <span style={{ color: CODE.string }}>"checkout"</span>
        <span style={{ color: CODE.punctuation }}>,</span>
      </div>
      <div>
        {"  "}
        <span style={{ color: CODE.parameter }}>request</span>
        <span style={{ color: CODE.punctuation }}>{": { "}</span>
        <span style={{ color: CODE.parameter }}>path</span>
        <span style={{ color: CODE.punctuation }}>: </span>
        <span style={{ color: CODE.string }}>"/checkout"</span>
        <span style={{ color: CODE.punctuation }}>{" },"}</span>
      </div>
      <div>
        <span style={{ color: CODE.punctuation }}>{"});"}</span>
      </div>
    </div>

    <div
      style={{
        margin: "28px 0 22px",
        height: 1,
        backgroundColor: COLORS.border,
      }}
    />

    <div style={{ fontSize: 15, color: COLORS.fgMuted, ...MONO }}>
      lands in PostHog as
    </div>

    <div
      style={{
        marginTop: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        fontSize: 20,
        ...MONO,
      }}
    >
      {LANDED.map(([property, value]) => (
        <div key={property} style={{ display: "flex" }}>
          <div style={{ width: 300, color: COLORS.fgMuted }}>{property}</div>
          <div style={{ color: CODE.string }}>{value}</div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Hero still: the error boundary catching on the left, the captureError
 * shape it ships on the right, an error-colored tether between them.
 */
export const ObservabilityStill: FC = () => (
  <SceneBackground>
    <Header />
    <BoundaryWindow />
    <Tether />
    <ShapeCard />
  </SceneBackground>
);
