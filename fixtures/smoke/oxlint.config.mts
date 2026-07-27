import react from "magic-oxlint-config/react";
import { defineConfig } from "oxlint";

/**
 * The fixture is *supposed* to fail. `scripts/smoke.mjs` runs oxlint against it
 * and asserts on the exact set of rules that fire, so a config change that
 * silently stops catching leaked JSX or process.env access breaks the build
 * instead of shipping.
 */
export default defineConfig({
  extends: [react],
  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
  rules: {
    "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
    "magic/no-barrel-file": "error",
  },
});
