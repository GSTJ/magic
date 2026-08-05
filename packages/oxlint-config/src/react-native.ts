import { filenameCaseIgnore, mocksFilenameCase } from "./base.ts";
import {
  extendConfig,
  jsPlugin,
  type MagicOxlintConfig,
  withEnvCarrier,
} from "./internal.ts";
import { react } from "./react.ts";

/**
 * React Native on top of `react`.
 *
 * Deliberately absent: the `no-restricted-imports` block banning Touchables /
 * Image in favour of `@/components/PressableArea`. That is a per-repo component
 * convention, not a general guideline, so it stays in each repo's own config.
 * See the README section "Restricting imports per repo" for the snippet.
 *
 * The four `react-native/*` rules below run from `magic-oxlint-plugin`, not from
 * `eslint-plugin-react-native`. The rule ids are unchanged — oxlint takes the
 * namespace from the `jsPlugins` entry's `name` — so configs and
 * `oxlint-disable` comments that name them keep working. The reason for the
 * port is that upstream declares a required `eslint` peer nothing calls, which
 * `autoInstallPeers` then installed into every consumer along with eslint 9's
 * `minimatch@3` -> `brace-expansion@1` tail. Parity was measured before the
 * swap: both plugins report the same 40 diagnostics over the same corpus, same
 * rule ids, spans and message text, and the same `--fix` output.
 *
 * Also absent: `reanimated/js-function-in-worklet`, which the old react-native
 * config ran at `error`. `eslint-plugin-reanimated@2.0.1` *loads* fine as a
 * jsPlugin, but the rule's `create()` bails out immediately unless
 * `context.parserServices.hasFullTypeInformation` is true — it resolves call
 * signatures through the TypeScript checker. oxlint's JS plugin API exposes no
 * parser services, so the rule installs and then reports nothing, which is worse
 * than leaving it out. Nothing replaces it: the safety net is the Reanimated
 * Babel plugin plus the runtime "tried to synchronously call a non-worklet
 * function on the UI thread" crash.
 */
const reactNativeConfig: MagicOxlintConfig = extendConfig(react, {
  jsPlugins: [jsPlugin("react-native", "magic-oxlint-plugin/react-native")],

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
    // react-native-gesture-handler's factory API is capitalized calls by
    // design (`Gesture.Pan()`, `Gesture.Tap()`, …). That is API-shaped, not
    // repo-shaped — every RN repo using gestures hits it — so the exception
    // list lives here rather than being rediscovered per repo. Mirrors MM.
    "new-cap": [
      "error",
      {
        capIsNewExceptions: [
          "Gesture.Pinch",
          "Gesture.Pan",
          "Gesture.Simultaneous",
          "Gesture.Race",
          "Gesture.Exclusive",
          "Gesture.Native",
          "Gesture.Tap",
          "Gesture.LongPress",
          "Gesture.Fling",
          "Gesture.Rotation",
          "Gesture.Manual",
          "Gesture.Hover",
        ],
      },
    ],

    // magic-oxlint-plugin/react-native. Same four rules, same ids, same
    // diagnostics — parity is measured in fixtures/adversarial/react-native.
    //
    // Gone with the dependency: `no-raw-text`, `sort-styles` and
    // `split-platform-components`, which this preset set to `off` and which
    // nothing here ported. They are not `off` entries any more because oxlint
    // treats a rule name a loaded plugin does not define as an error
    // ("Rule 'no-raw-text' not found in plugin 'react-native'", exit 1), so
    // naming them would break every consumer instead of quietly doing nothing.
    // A repo that wants one back adds upstream itself under its own namespace;
    // the README has the snippet.
    "react-native/no-inline-styles": "error",
    "react-native/no-color-literals": "error",
    "react-native/no-single-element-style-arrays": "error",
    "react-native/no-unused-styles": "error",

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

    // `App.tsx` is the one filename in a React Native app that is not the
    // repo's to rename. The bare-RN template's `index.js` imports `./App`, and
    // classic (pre-expo-router) Expo apps point `main` at
    // `node_modules/expo/AppEntry.js`, whose `import App from "../../App"` no
    // codemod can rewrite. Renaming to `app.tsx` therefore keeps working on a
    // macOS dev machine — APFS is case-insensitive — and fails only once the
    // build runs on Linux (EAS, CI). That is the worst failure shape available,
    // so `App` is exempt rather than left to a migration agent's judgement.
    // Anything the repo itself owns still gets renamed.
    "unicorn/filename-case": [
      "error",
      {
        case: "kebabCase",
        ignore: [...filenameCaseIgnore, String.raw`^App\.`],
      },
    ],
  },

  // Must stay last — see the `mocksFilenameCase` docblock in base.ts.
  overrides: [mocksFilenameCase],
});

export const reactNative: MagicOxlintConfig = withEnvCarrier(reactNativeConfig);

export default reactNative;
