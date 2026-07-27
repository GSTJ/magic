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
        "**/instrumentation.{js,ts}",
      ],
      rules: {
        "import/no-default-export": "off",
        "func-style": "off",
        "react/only-export-components": "off",
        // Server components and route handlers read env by definition.
        "no-restricted-properties": "off",
      },
    },
  ],
});

export default next;
