import react from "magic-oxlint-config/react";
import { defineConfig } from "oxlint";

/**
 * Every `@shopify/*` rule the incumbent ESLint config used, wired the way this
 * repo settles each one: the four rules ported into magic-oxlint-plugin, and
 * the native replacements copied verbatim from the snippets the plugin README
 * tells consumers to paste.
 *
 * The point of this fixture is that both halves are *executed*: a README
 * snippet that no longer fires is a lie the next migration agent inherits.
 */
export default defineConfig({
  extends: [react],

  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],

  rules: {
    // Ported into the plugin — no native equivalent exists.
    "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
    "magic/no-ancestor-directory-import": "error",
    "magic/react-require-autocomplete": [
      "error",
      { inputComponents: ["TextField"] },
    ],
    "magic/react-hooks-strict-return": "error",

    // `@shopify/restrict-full-import` (paths) and
    // `@shopify/strict-component-boundaries` (patterns). Both are project
    // policy, so they live in the consuming repo's config — here, in the
    // fixture that stands in for one. One rule key, both halves.
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "lodash",
            importNames: ["default"],
            message: "Import the single function you need: `lodash/debounce`.",
          },
        ],
        patterns: [
          {
            group: ["**/components/*/**"],
            message:
              "Do not reach into a component's folder. Import from its entry point.",
          },
        ],
      },
    ],

    // `@shopify/jsx-no-hardcoded-content`. Off in the `react` preset because it
    // only pays off with an i18n layer; this is what turning it on looks like.
    "react/jsx-no-literals": [
      "error",
      {
        noStrings: true,
        ignoreProps: true,
        allowedStrings: ["·"],
        elementOverrides: { Trans: { allowElement: true } },
      },
    ],
  },
});
