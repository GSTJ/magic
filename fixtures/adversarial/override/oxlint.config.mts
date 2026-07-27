import base, { testFilePlugins } from "magic-oxlint-config";
import { defineConfig } from "oxlint";

/**
 * A consumer trying to turn off a `jest/*` rule the preset sets inside its own
 * test-file override.
 *
 * `no-plugins.test.ts` uses the shape everyone writes first — an override entry
 * with only `rules` — which does NOTHING, because `jest` is enabled only inside
 * an override and a rule from a plugin that is not in *this* entry's plugin set
 * is silently ignored. `with-plugins.test.ts` repeats the list via the exported
 * `testFilePlugins` and works.
 */
export default defineConfig({
  extends: [base],
  ignorePatterns: base.ignorePatterns,
  overrides: [
    {
      files: ["**/no-plugins.test.ts"],
      rules: { "jest/valid-title": "off" },
    },
    {
      files: ["**/with-plugins.test.ts"],
      plugins: testFilePlugins,
      rules: { "jest/valid-title": "off" },
    },
  ],
});
