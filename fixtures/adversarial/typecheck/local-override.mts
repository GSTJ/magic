import base, { extendConfig, testFilePlugins } from "magic-oxlint-config";
import { defineConfig } from "oxlint";

// The README's "Local overrides" shape, plus the `testFilePlugins` escape hatch
// a consumer needs to reconfigure any `jest/*` rule the preset sets inside its
// own test-file override.
export const withLocalRules = defineConfig(
  extendConfig(base, {
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
  }),
);

// The opt-in plugin snippet from the README's "Opt-in rules" section: a
// jsPlugins entry added on top of a preset, still through extendConfig.
export const withPlugin = defineConfig(
  extendConfig(base, {
    jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
    rules: { "magic/prefer-early-return": ["error", { maximumStatements: 0 }] },
  }),
);
