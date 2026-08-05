import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

loadFont({
  display: "block",
  family: "Instrument Sans",
  format: "woff2",
  url: staticFile("fonts/instrument-sans-variable.woff2"),
  weight: "100 900",
});

loadFont({
  display: "block",
  family: "Instrument Serif",
  format: "woff2",
  style: "italic",
  url: staticFile("fonts/instrument-serif-italic.woff2"),
  weight: "400",
});

loadFont({
  display: "block",
  family: "JetBrains Mono",
  format: "woff2",
  url: staticFile("fonts/jetbrains-mono-variable.woff2"),
  weight: "100 800",
});

/**
 * Import these instead of retyping family strings: using the constant keeps
 * this module in every bundle, so the `loadFont` calls above always run.
 */
export const FONTS = {
  mono: "JetBrains Mono",
  sans: "Instrument Sans",
  serif: "Instrument Serif",
} as const;
