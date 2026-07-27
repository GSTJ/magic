import { mocksFilenameCase } from "./base.ts";
import { extendConfig, type MagicOxlintConfig } from "./internal.ts";
import { reactNative } from "./react-native.ts";

/**
 * Expo on top of `react-native`. The only real difference is expo-router, which
 * is file-based and therefore default-export driven.
 */
export const expo: MagicOxlintConfig = extendConfig(reactNative, {
  ignorePatterns: ["**/.expo/**", "**/expo-env.d.ts", "**/metro.config.js"],

  overrides: [
    {
      // expo-router routes, layouts and error boundaries are default exports by
      // contract, and `+html.tsx` / `+not-found.tsx` follow the same rule.
      files: [
        "**/app/**/*.{js,jsx,ts,tsx}",
        "**/app.config.{js,ts}",
        "**/babel.config.js",
      ],
      rules: {
        "import/no-default-export": "off",
        "func-style": "off",
      },
    },
    // expo-router needs no `unicorn/filename-case` exemption either: `_layout`
    // passes (leading underscores are trimmed before the check), `+not-found`
    // and `+html` pass (the rule only rejects uppercase, spaces and interior
    // underscores — every other punctuation character is fine), and `[id]` /
    // `[...rest]` are covered by the bracket entry in `filenameCaseIgnore`.
    // Group directories `(tabs)` are directories. Asserted in
    // `test/variants.test.mjs`.
    //
    // Must stay last — see the `mocksFilenameCase` docblock in base.ts.
    mocksFilenameCase,
  ],
});

export default expo;
