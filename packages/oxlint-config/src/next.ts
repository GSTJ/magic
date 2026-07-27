import { mocksFilenameCase } from "./base.ts";
import { extendConfig, type MagicOxlintConfig } from "./internal.ts";
import { react } from "./react.ts";

/**
 * Next.js on top of `react`. The `nextjs` plugin is native to oxlint, so no JS
 * plugin and no `@next/eslint-plugin-next` dependency is needed.
 */
export const next: MagicOxlintConfig = extendConfig(react, {
  plugins: ["nextjs"],

  ignorePatterns: ["**/.next/**", "**/out/**", "**/next-env.d.ts"],

  rules: {
    "nextjs/google-font-display": "error",
    "nextjs/google-font-preconnect": "error",
    "nextjs/inline-script-id": "error",
    "nextjs/next-script-for-ga": "error",
    "nextjs/no-assign-module-variable": "error",
    "nextjs/no-async-client-component": "error",
    "nextjs/no-before-interactive-script-outside-document": "error",
    "nextjs/no-css-tags": "error",
    "nextjs/no-document-import-in-page": "error",
    "nextjs/no-duplicate-head": "error",
    "nextjs/no-head-element": "error",
    "nextjs/no-head-import-in-document": "error",
    "nextjs/no-html-link-for-pages": "error",
    "nextjs/no-img-element": "error",
    "nextjs/no-page-custom-font": "error",
    "nextjs/no-script-component-in-head": "error",
    "nextjs/no-styled-jsx-in-document": "error",
    "nextjs/no-sync-scripts": "error",
    "nextjs/no-title-in-document-head": "error",
    "nextjs/no-typos": "error",
    "nextjs/no-unwanted-polyfillio": "error",
  },

  overrides: [
    {
      // The App Router is built on default exports and on `export function GET`,
      // and `export const metadata` sits next to a default-exported component.
      files: [
        "**/app/**/{page,layout,template,loading,error,not-found,route,default,global-error}.{js,jsx,ts,tsx}",
        "**/app/**/{sitemap,robots,manifest,opengraph-image,twitter-image,icon,apple-icon}.{js,jsx,ts,tsx}",
        "**/pages/**",
        "**/middleware.{js,ts}",
        // Next 16's rename of `middleware`. Listed now so the exemptions do not
        // silently stop applying on the upgrade.
        "**/proxy.{js,ts}",
        "**/instrumentation.{js,ts}",
      ],
      rules: {
        "import/no-default-export": "off",
        "func-style": "off",
        "react/only-export-components": "off",
        // Server components and route handlers read env by definition.
        "no-restricted-properties": "off",

        // Exempting `import/no-default-export` and `func-style` alone left no
        // page shape that passes: the idiomatic `export default async () => {}`
        // trips `import/no-anonymous-default-export`, and the obvious fix
        // `export default function Page()` trips
        // `react/function-component-definition`, which the react preset pins to
        // arrow functions. Only `const Page = …; export default Page` satisfied
        // both, which is not a convention worth enforcing on framework files.
        // `import/no-anonymous-default-export` is on deliberately (DECISIONS §2)
        // with "config files where it is idiomatic get an override exemption
        // instead" — App Router pages are that case and had been missed.
        "react/function-component-definition": "off",
        "import/no-anonymous-default-export": "off",

        // Next statically analyses the `config` export of `middleware.ts` and
        // understands a small, fixed set of node types. `unicorn/prefer-string-raw`
        // autofixes `matcher: ["/((?!api|_next|.*\\..*).*)"]` into a
        // `String.raw` tagged template, and the build then dies with
        // `Unsupported node type "TaggedTemplateExpression"` — while lint,
        // typecheck and tests all stay green. A statically-analysed export is a
        // framework contract, not a style choice.
        "unicorn/prefer-string-raw": "off",
      },
    },
    // No `unicorn/filename-case` exemption is needed for the App Router: every
    // reserved filename is already kebab-valid (`page`, `layout`, `not-found`,
    // `global-error`, `opengraph-image`, `route`, `middleware`), and `_app` /
    // `_document` pass because the rule trims leading underscores before
    // checking. Dynamic segments (`[postId].tsx`) are covered by the bracket
    // entry in `filenameCaseIgnore`. Route groups `(marketing)`, parallel
    // routes `@modal` and intercepting routes `(.)photo` are *directory* names,
    // and the rule only ever looks at basenames. `test/variants.test.mjs`
    // asserts all of that against a real App Router tree rather than trusting
    // this comment.
    //
    // Must stay last — see the `mocksFilenameCase` docblock in base.ts.
    mocksFilenameCase,
  ],
});

export default next;
