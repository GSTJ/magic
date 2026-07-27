import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

/**
 * This repo eats its own cooking: it lints itself with the config it publishes.
 *
 * `fixtures/smoke` is excluded because it is deliberately broken — it gets
 * linted on purpose by `scripts/smoke.mjs`, which asserts on what fires.
 */
export default defineConfig({
  extends: [base],
  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
  ignorePatterns: [
    "fixtures/**/*",
    "packages/*/dist/**",
    "packages/oxlint-config/*.json",
  ],
  rules: {
    "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
    "magic/no-barrel-file": "error",
  },
});
