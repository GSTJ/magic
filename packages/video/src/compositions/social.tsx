import type { CSSProperties, FC } from "react";

import { COLORS } from "../brand";
import { FONTS } from "../fonts";
import { BrandMark, SceneBackground, Tagline } from "../primitives";

const CENTERED: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 28,
  // GitHub crops the 2:1 card differently per surface; keep everything that
  // matters inside a 96px inset, a tenth of the frame from every edge.
  padding: 96,
};

/**
 * The repo social card: mark, wordmark, one sentence, on the quiet sparkle
 * field every scene shares. Everything is drawn from the theme's own colors,
 * so the card restyles itself with the brand.
 */
export const MagicSocial: FC = () => (
  <SceneBackground>
    <div style={CENTERED}>
      <BrandMark size={88} />
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize: 96,
          letterSpacing: -4,
          color: COLORS.fg,
        }}
      >
        magic
      </div>
      <Tagline fontSize={32}>Change it once. Every repo gets it.</Tagline>
    </div>
  </SceneBackground>
);
