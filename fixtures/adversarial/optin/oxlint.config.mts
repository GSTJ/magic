import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

// Base preset PLUS the opt-in magic rules, wired exactly as the root README's
// "Opt-in rules" section says a consumer would.
export default defineConfig({
  extends: [base],
  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
  rules: {
    "magic/no-manual-classname": "error",
    "magic/no-module-mocks": "error",
    "magic/prefer-suspense-query": ["error", { roots: ["api", "trpc"] }],
  },
});
