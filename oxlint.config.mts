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
    // The three rules ported from @shopify in this pass are exercised by
    // fixtures/adversarial/shopify, not here. `no-ancestor-directory-import`
    // fires on this repo's own `src/cli.ts` importing `./index.ts` — the
    // functions it needs are *defined* there, so there is no other file to
    // name and no cycle to break. See DECISIONS.md §6.
  },
});
