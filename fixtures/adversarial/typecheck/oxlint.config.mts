import { extendConfig } from "magic-oxlint-config";
import base from "magic-oxlint-config/base";
import { defineConfig, type OxlintConfig } from "oxlint";

// The root README, Step 2. The recommended file is a re-export
// (`export { default } from "magic-oxlint-config/base"`), which has no
// expression for tsc to check — so what gets compiled here is the assignment it
// desugars to: the preset object itself has to satisfy oxlint's own config type.
export const reExported: OxlintConfig = base;

// ...and the form Step 2 points at for repo-specific rules. `extendConfig`
// returns a `MagicOxlintConfig`, which has to be assignable too, or the README's
// own snippet fails `tsc --noEmit` in every repo that includes *.config.mts.
export default defineConfig(
  extendConfig(base, { rules: { "no-console": "off" } }),
);
