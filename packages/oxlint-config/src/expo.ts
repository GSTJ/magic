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
  ],
});

export default expo;
