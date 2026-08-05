<p align="center">
  <img alt="A rendered magic-docs page: sidebar navigation, content column, and a generated type table" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-docs.png" />
</p>

<p align="center">One validated site contract drives the Fumadocs layout, theme, type tables, llms.txt output, and GitHub Pages export.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-docs"><img alt="npm version" src="https://shieldcn.dev/npm/magic-docs.svg?variant=branded&size=xs&mode=light" /></a>
  <a aria-label="npm downloads" href="https://www.npmjs.com/package/magic-docs"><img alt="npm downloads" src="https://shieldcn.dev/npm/magic-docs/downloads.svg?variant=branded&size=xs&mode=light" /></a>
  <a aria-label="GitHub stars" href="https://github.com/GSTJ/magic/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/GSTJ/magic/stars.svg?variant=branded&size=xs&mode=light" /></a>
  <a aria-label="license" href="https://github.com/GSTJ/magic/blob/main/LICENSE"><img alt="license" src="https://shieldcn.dev/github/GSTJ/magic/license.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## How it works

1. `defineMagicDocs` validates one site contract (name, URLs, package) at config evaluation time,
   and every helper below derives from it.
2. Presets wrap Fumadocs with the shared layout, MDX components, Tailwind v4 theme, build-time
   TypeScript reference tables, and clean copy-as-Markdown, `llms.txt`, and `llms-full.txt`
   output.
3. `createMagicDocsStaticExport` turns the app into a static Next export that GitHub Pages serves
   under a project path.

```ts
// lib/site.ts
import { createMagicDocsPublicPaths, defineMagicDocs } from "magic-docs";

export const site = defineMagicDocs({
  name: "React Native Magic Modal",
  description: "An imperative, promise-based modal library for React Native.",
  siteUrl: "https://gstj.github.io/react-native-magic-modal",
  repository: "https://github.com/GSTJ/react-native-magic-modal",
  packageName: "react-native-magic-modal",
});

export const publicPaths = createMagicDocsPublicPaths(site);
```

This is intentionally a preset. Content stays in each package repository;
the preset centralizes the parts that should not drift. Packages still own their examples,
guides, API decisions, and deploy workflow.

## Install

Install the framework packages in the docs application:

```sh
pnpm add next@16 react@^19.2.0 react-dom@^19.2.0 \
  fumadocs-core@16.12.1 fumadocs-mdx@15.2.0 \
  fumadocs-ui@npm:@fumadocs/base-ui@16.12.1 magic-docs
pnpm add -D typescript@6.0.3 tailwindcss @tailwindcss/postcss
```

The `fumadocs-ui` alias selects Base UI while preserving Fumadocs' documented import paths.

## Compatibility

The package is built and tested with:

| Dependency              | Version                                |
| ----------------------- | -------------------------------------- |
| Fumadocs Core/UI        | `16.12.1`                              |
| Fumadocs MDX            | `15.2.0`                               |
| Fumadocs TypeScript     | `5.3.0`                                |
| React / React DOM       | `^19.2.0`                              |
| TypeScript for docs app | `6.0.3`                                |
| UI implementation       | Base UI (the current Fumadocs default) |

`16.12.1` is the newest Fumadocs UI release outside this monorepo's three-day supply-chain
quarantine at the time of the preset. The peer range accepts newer compatible 16.x versions.
TypeScript is pinned separately from the `magic` root: the root currently tests TypeScript 7,
while framework docs apps stay on the compiler compatible with their Next/Fumadocs stack.

## Site contract

The `defineMagicDocs` call above is the whole contract: define the package once and reuse the
result everywhere. Invalid or relative URLs fail during config evaluation. `siteUrl` includes the
GitHub Pages project path; that path is the source of truth for every public URL below.

## Theme

For package consumption:

```css
/* app/global.css */
@import "tailwindcss";
@import "magic-docs/theme.css";
```

To keep a repository-owned snapshot instead:

```sh
pnpm exec magic-docs-init --out app/magic-docs.css
```

The command is idempotent, refuses to overwrite a customized copy without `--force`, and also
creates `public/.nojekyll`. Import the copied file after Tailwind:

```css
@import "tailwindcss";
@import "./magic-docs.css";
```

A package can override the font variables without forking the theme:

```css
:root {
  --font-magic-sans: var(--font-geist-sans);
  --font-magic-mono: var(--font-geist-mono);
}
```

## Layout and MDX

Keep the classic docs layout: it has persistent navigation, search, and a table of contents.

```tsx
// app/(docs)/layout.tsx
import { createMagicDocsLayout } from "magic-docs/fumadocs";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { site } from "@/lib/site";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <DocsLayout {...createMagicDocsLayout(site)} tree={source.getPageTree()}>
      {children}
    </DocsLayout>
  );
}
```

`createMagicDocsLayout` keeps GitHub, npm, theme, and search controls consistent. Add
package-specific links through its `links` option.

The shared MDX vocabulary includes Fumadocs' default cards, callouts, headings, and code blocks
plus accordions, file trees, steps, tabs, and type tables:

```tsx
// mdx-components.tsx
import { createMagicDocsMdxComponents } from "magic-docs/mdx";

export const getMDXComponents = createMagicDocsMdxComponents;
export const useMDXComponents = createMagicDocsMdxComponents;
```

## Type tables

Use build-time generation. Paths stay relative to the MDX file and static export does not need
the TypeScript filesystem at runtime.

```ts
// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { magicDocsLlmMdxOptions } from "magic-docs/llms";
import { createMagicDocsTypeScript } from "magic-docs/typescript";

const typescript = createMagicDocsTypeScript({
  cacheDirectory: ".next/fumadocs-typescript",
});

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: magicDocsLlmMdxOptions,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [typescript.remarkPlugin],
  },
});
```

Then reference a public type:

```mdx
<auto-type-table path="../../../src/types.ts" name="ModalProps" />
```

Generated tables supplement prose. In `fumadocs-typescript@5.3.0`,
object/interface properties work well, but:

- top-level functions generate no useful entries;
- enums can expose inherited `String` prototype members;
- property `@description` tags do not become the table summary.

Document functions and enums manually, and use normal JSDoc prose on object properties. Keep
generated reference pages behind task-first quickstarts and guides.

## Agent-readable docs

`magicDocsLlmMdxOptions` is not optional when generated TypeTables are present. Without its
`TypeTable` placeholder, Fumadocs serializes the generated prop's full JSON/ESTree into processed
Markdown.

Use the shared renderer for page Markdown and `llms-full.txt`:

```ts
import { createMagicDocsLlmPage } from "magic-docs/llms";

import { site } from "@/lib/site";

export async function getLlmText(page: (typeof source)["$inferPage"]) {
  return createMagicDocsLlmPage(site, {
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    processedMarkdown: await page.data.getText("processed"),
  });
}
```

It renders a compact Markdown list with property name, full type, required/optional, deprecation,
default, and description.

Fumadocs' `llms(source).index()` emits application-relative links. Prefix them before returning
`llms.txt`:

```ts
import { llms } from "fumadocs-core/source";
import { prefixMagicDocsLlmLinks } from "magic-docs/llms";

export function GET() {
  return new Response(prefixMagicDocsLlmLinks(site, llms(source).index()));
}
```

## Static export on GitHub Pages

The portable Next config is:

```ts
// next.config.ts
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import { createMagicDocsStaticExport } from "magic-docs";

import { site } from "./lib/site";

const withMdx = createMDX();
const config = createMagicDocsStaticExport(site) satisfies NextConfig;

export default withMdx(config);
```

It sets `output: "export"`, `trailingSlash`, unoptimized images, and `basePath`. It deliberately
does not set `assetPrefix`: Next handles `/_next` assets from `basePath` and does not recommend
`assetPrefix` for sub-path hosting.

`basePath` does not rewrite fetch URLs or strings. Use the shared paths for the places outside
the Next router:

```ts
import { oramaStaticClient } from "fumadocs-core/search/client/orama-static";

import { publicPaths } from "@/lib/site";

const search = oramaStaticClient({ from: publicPaths.searchApi });

publicPaths.markdown(page.url); // copy-Markdown button URL
publicPaths.llms; // /<project>/llms.txt
publicPaths.llmsFull; // /<project>/llms-full.txt
publicPaths.url(page.url); // canonical/OG absolute URL
```

Static search also needs a static route:

```ts
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source);
```

The Pages workflow must preserve hidden files:

```yaml
- uses: actions/upload-pages-artifact@v4
  with:
    path: out
    include-hidden-files: true
```

Without `include-hidden-files`, the generated `public/.nojekyll` disappears during upload and
GitHub may process the export with Jekyll.

## Adoption before the first npm release

Create a real package tarball:

```sh
# in GSTJ/magic
pnpm --filter magic-docs pack --pack-destination ./artifacts
```

For a full pre-release adoption, copy the tarball into the consumer:

```text
vendor/magic-docs-1.0.0.tgz
```

and install that committed artifact:

```sh
pnpm add ./vendor/magic-docs-1.0.0.tgz
pnpm exec magic-docs-init --out app/magic-docs.css
```

The frozen lockfile then depends only on a file committed in the consumer. After the first
publish, replace the
`file:vendor/...tgz` spec with the npm version; none of the imports or config change.

For a theme-only bootstrap, run the CLI from the tarball, commit the generated CSS and
`.nojekyll`, and do not retain `magic-docs` as a dependency until it is published.

```sh
pnpm dlx ./artifacts/magic-docs-1.0.0.tgz \
  --out app/magic-docs.css
```

## Content standard

Every package starts with this order:

1. Overview and a concrete result.
2. Install.
3. Five-minute quickstart.
4. Task-oriented guides and recipes.
5. API reference.
6. Troubleshooting and migration notes.

Reference pages are generated from source. Each public feature needs at least one runnable example and a plain-language explanation of when to
use it.
