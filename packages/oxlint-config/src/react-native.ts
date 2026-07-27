import { extendConfig, jsPlugin, type MagicOxlintConfig } from "./internal.ts";
import { react } from "./react.ts";

/**
 * React Native on top of `react`.
 *
 * Deliberately absent: the `no-restricted-imports` block banning Touchables /
 * Image in favour of `@/components/PressableArea`. That is a per-repo component
 * convention, not a general guideline, so it stays in each repo's own config.
 * See the README section "Restricting imports per repo" for the snippet.
 */
export const reactNative: MagicOxlintConfig = extendConfig(react, {
  jsPlugins: [jsPlugin("react-native", "eslint-plugin-react-native")],

  globals: {
    __DEV__: "readonly",
  },

  ignorePatterns: [
    "**/ios/**",
    "**/android/**",
    "**/*.pbxproj",
    "**/Pods/**",
    "**/DerivedData/**",
  ],

  rules: {
    "react-native/no-inline-styles": "error",
    "react-native/no-color-literals": "error",
    "react-native/no-single-element-style-arrays": "error",
    "react-native/no-unused-styles": "error",
    // Requires a design-system <Text> wrapper to be useful; too noisy without one.
    "react-native/no-raw-text": "off",
    "react-native/sort-styles": "off",
    "react-native/split-platform-components": "off",

    // React Native has no DOM. jsx-a11y's rules target DOM elements and roles
    // and produce nothing but false positives against RN primitives.
    "jsx-a11y/alt-text": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "jsx-a11y/click-events-have-key-events": "off",
    "jsx-a11y/no-static-element-interactions": "off",

    // react-perf assumes a reconciler where a new object prop always costs a
    // re-render. Under the React Compiler and RN's own memoisation this fires
    // constantly on code that is fine.
    "react-perf/jsx-no-new-object-as-prop": "off",
    "react-perf/jsx-no-new-array-as-prop": "off",
    "react-perf/jsx-no-new-function-as-prop": "off",
    "react-perf/jsx-no-jsx-as-prop": "off",

    // `no-unknown-property` only knows DOM attributes.
    "react/no-unknown-property": "off",
    "react/no-unescaped-entities": "off",
  },
});

export default reactNative;
