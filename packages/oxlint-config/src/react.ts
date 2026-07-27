import { base } from "./base.ts";
import { extendConfig, jsPlugin, type MagicOxlintConfig } from "./internal.ts";

/**
 * React on top of `base`. Adds the react / react-perf / jsx-a11y plugins and
 * wires in eslint-plugin-safe-jsx, which has no oxlint equivalent and catches
 * the single most common React bug in this codebase family: `items.length &&
 * <Row/>` rendering a bare `0`.
 */
export const react: MagicOxlintConfig = extendConfig(base, {
  plugins: ["react", "react-perf", "jsx-a11y"],

  jsPlugins: [jsPlugin("safe-jsx", "eslint-plugin-safe-jsx")],

  globals: {
    React: "readonly",
  },

  rules: {
    "safe-jsx/jsx-explicit-boolean": "error",

    // The modern JSX transform means React no longer has to be in scope.
    "react/react-in-jsx-scope": "off",
    "react/display-name": "off",
    "react/style-prop-object": "off",
    "react/jsx-props-no-spreading": "off",
    "react/jsx-max-depth": "off",
    "react/hook-use-state": "off",
    "react/jsx-handler-names": "off",
    "react/jsx-no-literals": "off",
    "react/jsx-filename-extension": "off",
    "react/no-multi-comp": "off",
    "react/no-set-state": "off",
    "react/forbid-component-props": "off",
    "react/forbid-dom-props": "off",
    "react/forbid-elements": "off",
    "react/prefer-es6-class": "off",
    "react/prefer-function-component": "off",
    "react/state-in-constructor": "off",

    // Hooks. oxlint exposes these under the `react` namespace; the
    // `react-hooks/` spelling is accepted as an alias but the diagnostics
    // print as `react-hooks(...)` either way.
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",

    // Correctness
    "react/jsx-key": [
      "error",
      { checkFragmentShorthand: true, warnOnDuplicates: true },
    ],
    "react/jsx-no-constructed-context-values": "error",
    "react/jsx-no-script-url": "error",
    "react/jsx-no-target-blank": "error",
    "react/jsx-no-duplicate-props": "error",
    "react/jsx-no-comment-textnodes": "error",
    "react/jsx-no-undef": "error",
    "react/no-array-index-key": "error",
    "react/no-children-prop": "error",
    "react/no-clone-element": "error",
    "react/no-danger": "error",
    "react/no-danger-with-children": "error",
    "react/no-direct-mutation-state": "error",
    "react/no-find-dom-node": "error",
    "react/no-is-mounted": "error",
    "react/no-object-type-as-default-prop": "error",
    "react/no-redundant-should-component-update": "error",
    "react/no-render-return-value": "error",
    "react/no-string-refs": "error",
    "react/no-this-in-sfc": "error",
    "react/no-unescaped-entities": "error",
    "react/no-unknown-property": "error",
    "react/no-unsafe": "error",
    "react/no-unstable-nested-components": ["error", { allowAsProps: false }],
    "react/require-render-return": "error",
    "react/void-dom-elements-no-children": "error",
    "react/iframe-missing-sandbox": "error",
    "react/forward-ref-uses-ref": "error",
    "react/checked-requires-onchange-or-readonly": "error",
    "react/button-has-type": "error",

    // The one `nursery` rule worth switching on: it runs the React Compiler in
    // lint-only mode and is the direct replacement for the
    // `react-compiler/react-compiler` rule the ESLint config carried.
    "react/react-compiler": "error",

    // Style
    "react/jsx-boolean-value": ["error", "never"],
    "react/jsx-curly-brace-presence": [
      "error",
      { props: "never", children: "never" },
    ],
    "react/jsx-fragments": "error",
    "react/jsx-no-useless-fragment": ["error", { allowExpressions: true }],
    "react/jsx-pascal-case": "error",
    "react/self-closing-comp": ["error", { component: true }],
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "arrow-function",
        unnamedComponents: "arrow-function",
      },
    ],

    // Autofocus steals focus from screen readers but is genuinely correct in
    // modals and search bars, which is most of where it appears here.
    "jsx-a11y/no-autofocus": "off",
  },

  overrides: [
    {
      files: [
        "**/*.test.{js,jsx,ts,tsx}",
        "**/*.spec.{js,jsx,ts,tsx}",
        "**/__tests__/**",
      ],
      rules: {
        "react/rules-of-hooks": "off",
        "react/no-unstable-nested-components": "off",
        "react-perf/jsx-no-new-object-as-prop": "off",
        "react-perf/jsx-no-new-array-as-prop": "off",
        "react-perf/jsx-no-new-function-as-prop": "off",
        "react-perf/jsx-no-jsx-as-prop": "off",
      },
    },
  ],
});

export default react;
