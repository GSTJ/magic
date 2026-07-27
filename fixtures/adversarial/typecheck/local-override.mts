import base, { extendConfig, testFilePlugins } from "magic-oxlint-config";
import { defineConfig } from "oxlint";

// The README's "Local overrides" shape, plus the `testFilePlugins` escape hatch
// a consumer needs to reconfigure any `jest/*` rule the preset sets inside its
// own test-file override.
export const withLocalRules = defineConfig({
  extends: [base],
  ignorePatterns: base.ignorePatterns,
  rules: {
    "no-restricted-imports": [
      "error",
      { paths: [{ name: "react-native", importNames: ["Image"] }] },
    ],
  },
  overrides: [
    {
      files: ["**/*.test.ts"],
      plugins: testFilePlugins,
      rules: { "jest/valid-title": "off" },
    },
  ],
});

// `extendConfig` flattens instead of using oxlint's `extends`, so
// `ignorePatterns` cannot be forgotten. Its result has to be a valid config too.
export const flattened = defineConfig(
  extendConfig(base, { rules: { "no-console": "off" } }),
);
