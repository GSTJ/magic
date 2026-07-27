import { extendConfig } from "magic-oxlint-config";
import base from "magic-oxlint-config/base";

/**
 * This repo eats its own cooking: it lints itself with the config it publishes,
 * in the shape the README tells consumers to write.
 *
 * `extendConfig` rather than oxlint's `extends`. The latter drops the preset's
 * `ignorePatterns` — this file used to re-attach them by hand, which worked and
 * was still the wrong template to hand consumers — and it drops `env`, which
 * meant this repo had been linting itself with no node or browser environment
 * at all.
 *
 * `fixtures/smoke` is excluded because it is deliberately broken — it gets
 * linted on purpose by `scripts/smoke.mjs`, which asserts on what fires.
 */
export default extendConfig(base, {
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
