# magic

Shared tooling for GSTJ projects. One place for lint, format, TypeScript config,
CI workflows and Renovate settings, so twelve repos stop each having their own
slightly-wrong version.

| Package                                         | What it is                                                      |
| ----------------------------------------------- | --------------------------------------------------------------- |
| [`magic-oxlint-config`](packages/oxlint-config) | oxlint presets: `base`, `react`, `react-native`, `next`, `expo` |
| [`magic-oxfmt-config`](packages/oxfmt-config)   | oxfmt config, including the import sort order                   |
| [`magic-oxlint-plugin`](packages/oxlint-plugin) | Seven opt-in lint rules with no oxlint equivalent               |
| [`magic-tsconfig`](packages/tsconfig)           | `base`, `internal-package`, `nextjs`, `expo` TypeScript bases   |
| [`magic-codemods`](packages/codemods)           | `magic-kebab`: the kebab-case filename migration                |
| `.github/workflows/ci.yml`                      | Reusable `workflow_call` job: install, lint, format, typecheck  |
| `.github/workflows/release.yml`                 | Reusable `workflow_call` job: build and publish to npm          |
| `default.json`                                  | Renovate preset, consumable as `github>GSTJ/magic`              |

ESLint and Prettier no longer _run_ anywhere: oxlint replaces ESLint, oxfmt
replaces Prettier **and** `@ianvs/prettier-plugin-sort-imports`.

`eslint` itself is still in the tree, though, and it is worth saying so plainly.
`magic-oxlint-config` depends on two ESLint plugins that oxlint loads as JS
plugins — `eslint-plugin-safe-jsx` and `eslint-plugin-react-native` — and both
declare a **required** `eslint` peer, so pnpm's default `autoInstallPeers` drags
eslint 9 and ~16 `@eslint`/`@typescript-eslint` directories back in. Nothing
executes them; it is node_modules weight and a confusing lockfile. See the pnpm
section for the `peerDependencyRules` stanza that stops it, and DECISIONS.md §4
for why it is not fixed at the source yet.

---

## Setup, by project type

Every project gets the same four steps. Only the variant name changes.

### Step 1 — install

```sh
pnpm add -D oxlint@1.75.0 oxfmt@0.60.0 magic-oxlint-config magic-oxfmt-config magic-tsconfig
```

Pin `oxlint` and `oxfmt` exactly. Both add and remove rules between minor
versions, and an unknown rule name is a **fatal** config error, not a warning —
an unpinned bump can break every repo at once. The shared Renovate preset groups
them and never automerges them for this reason.

### Step 2 — `oxlint.config.mts`

Pick the line that matches the project. Everything else is identical.

```ts
// oxlint.config.mts
export { default } from "magic-oxlint-config/base"; // plain TypeScript / Node / library
// export { default } from "magic-oxlint-config/react";         // React web, no framework
// export { default } from "magic-oxlint-config/next";          // Next.js
// export { default } from "magic-oxlint-config/react-native";  // bare React Native
// export { default } from "magic-oxlint-config/expo";          // Expo
```

That's the whole file. It is a re-export for the same reason Step 3 is, and for
one more: **oxlint's `extends` silently drops `ignorePatterns`.** A config whose
whole body is `defineConfig({ extends: [base] })` gets none of the preset's
ignore patterns — verified on 1.75.0, and with no `.gitignore` in the way that
run reported ~500k diagnostics out of `node_modules`. Re-exporting the preset
means oxlint loads it as _the_ config and every field applies.

Repo-specific rules go through `extendConfig`, which flattens rather than using
`extends`, so the same hazard cannot come back — see
[Local overrides](#local-overrides).

If you would rather write `defineConfig({ extends: [...] })`, you must re-declare
the ignore patterns yourself, every time:

```ts
import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  ignorePatterns: base.ignorePatterns, // `extends` does not carry these
});
```

### Step 3 — `oxfmt.config.mts`

```ts
// oxfmt.config.mts
export { default } from "magic-oxfmt-config";
```

Variants, if the project has native or framework directories to skip:

```ts
// oxfmt.config.mts — also: react, reactNative, next
export { expo as default } from "magic-oxfmt-config";
```

Write it as a re-export, not `import base from …; export default base;`. The two
behave identically in oxfmt and the re-export is the shorter, clearer of the two.
(This used to be enforced: `unicorn/prefer-export-from` failed the import-then-
default-export form, so `pnpm run lint` exited 1 on the file this README told you
to write. That rule is now `"off"` — its autofix deletes exports, see Gotchas —
so this is style advice again rather than a rule you will trip over.) If the
config needs to change something — extra `ignorePatterns`, say — spread it into
a new object instead, which is what this repo's own `oxfmt.config.mts` does.

Then delete `.prettierrc`, `.prettierignore`, `prettier.config.*`, and the
`prettier` key from `package.json`.

### Step 4 — `tsconfig.json` and scripts

```jsonc
// tsconfig.json — pick one "extends"
{ "extends": "magic-tsconfig/base.json" }
// { "extends": "magic-tsconfig/internal-package.json" }   // publishable library
// { "extends": "magic-tsconfig/nextjs.json" }             // Next.js
// { "extends": ["expo/tsconfig.base", "magic-tsconfig/expo.json"] }  // Expo
```

```jsonc
// package.json
{
  "scripts": {
    "lint": "oxlint --report-unused-disable-directives",
    "lint:fix": "oxlint --report-unused-disable-directives --fix",
    "format": "oxfmt --check .",
    "format:fix": "oxfmt .",
    "typecheck": "tsc --noEmit",
  },
}
```

`--report-unused-disable-directives` matters: the old ESLint config baked
`reportUnusedDisableDirectives` into the shared config so stale
`// eslint-disable` comments couldn't accumulate. oxlint has no config key for
it — the flag is the only carrier, so it lives in the script.

In a monorepo, add `--disable-nested-config` to the root `lint` script. See
[Gotchas](#gotchas).

---

## Copy-paste per project type

### Plain TypeScript / Node library

```sh
pnpm add -D oxlint@1.75.0 oxfmt@0.60.0 magic-oxlint-config magic-oxfmt-config magic-tsconfig @types/node
```

(`@types/node` because `magic-tsconfig/base.json` doesn't pull in any global
type packages — without it the first `process.` or `node:fs` import fails
typecheck.)

```ts
// oxlint.config.mts
export { default } from "magic-oxlint-config/base";
```

```ts
// oxfmt.config.mts
export { default } from "magic-oxfmt-config";
```

```jsonc
// tsconfig.json — typecheck only, no emit
{
  "extends": "magic-tsconfig/base.json",
  "include": ["src"],
  "compilerOptions": {
    // Required under TypeScript 7 (tsgo): auto-inclusion of @types packages
    // does not kick in with this config shape, so `process` and `node:*`
    // imports fail typecheck without it. Verified against tsgo 7.0.2.
    "types": ["node"],
  },
}
```

```jsonc
// tsconfig.build.json — what `pnpm run build` uses
{
  "extends": "magic-tsconfig/base.json",
  "include": ["src"],
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "types": ["node"],
  },
}
```

**Do not reach for `magic-tsconfig/internal-package.json` here.** Its name means
what it says: an _internal workspace_ package whose JavaScript comes from a
bundler. It sets `emitDeclarationOnly: true`, so `tsc -p tsconfig.json` produces
`.d.ts` and `.d.ts.map` and **no `.js` at all** — a package with `main:
dist/index.js` and nothing behind it. Pairing it with `outDir`/`rootDir` reads
exactly like a normal emit config, which is how it got into this section in the
first place. A library that publishes tsc output extends `base.json` in a
separate `tsconfig.build.json`, as above; that is what every package in this repo
does.

Add `*.tsbuildinfo` to `.gitignore` if the repo ever turns `incremental` on. The
shared bases do not (a base that publishable packages extend has no business
carrying build-cache state), but a repo that opts in gets one written next to
every tsconfig — and if it lands _outside_ `outDir`, `rimraf dist && tsc` emits
nothing on the second run, exit 0, no output, no error. Scope it:
`"tsBuildInfoFile": "dist/.tsbuildinfo"`.

### Next.js

```sh
pnpm add -D oxlint@1.75.0 oxfmt@0.60.0 magic-oxlint-config magic-oxfmt-config magic-tsconfig
pnpm remove eslint eslint-config-next @next/eslint-plugin-next prettier
```

```ts
// oxlint.config.mts
export { default } from "magic-oxlint-config/next";
```

```ts
// oxfmt.config.mts
export { next as default } from "magic-oxfmt-config";
```

```jsonc
// tsconfig.json
{
  "extends": "magic-tsconfig/nextjs.json",
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] },
    // Needed under TypeScript 7 (tsgo), which doesn't auto-include @types
    // packages with this config shape — without it `process.env` fails
    // typecheck even with @types/node installed.
    "types": ["node"],
  },
}
```

For App Router file conventions (`page.tsx`, `layout.tsx`, `route.ts`,
`middleware.ts`, `proxy.ts`, `sitemap.ts`, and the rest) the `next` preset turns
off exactly these, so those files need no local exceptions:

| Rule                                  | Why it has to be off there                                            |
| ------------------------------------- | --------------------------------------------------------------------- |
| `import/no-default-export`            | the App Router is built on default exports                            |
| `import/no-anonymous-default-export`  | `export default async () => {}` is the idiomatic page                 |
| `func-style`                          | `export function GET()` is a route handler                            |
| `react/function-component-definition` | ...and so `export default function Page()` has to be allowed too      |
| `react/only-export-components`        | `export const metadata` sits next to the component                    |
| `no-restricted-properties`            | server components and route handlers read `process.env` by definition |
| `unicorn/prefer-string-raw`           | Next statically analyses `middleware.ts`'s `config` export            |

The last two rows are the ones that cost real time. `prefer-string-raw` autofixes
`matcher: ["/((?!api|_next|.*\\..*).*)"]` into a `String.raw` tagged template,
and `next build` then fails with `Unsupported node type
"TaggedTemplateExpression"` while lint, typecheck and tests all stay green. And
until `react/function-component-definition` joined the list, no page shape passed:
the anonymous arrow tripped `no-anonymous-default-export`, and the named function
tripped `function-component-definition`.

### Expo

```sh
pnpm add -D oxlint@1.75.0 oxfmt@0.60.0 magic-oxlint-config magic-oxfmt-config magic-tsconfig
pnpm remove eslint eslint-config-expo prettier
```

```ts
// oxlint.config.mts
export { default } from "magic-oxlint-config/expo";
```

```ts
// oxfmt.config.mts
export { expo as default } from "magic-oxfmt-config";
```

```jsonc
// tsconfig.json — Expo's base first, so ours wins on conflicts
{
  "extends": ["expo/tsconfig.base", "magic-tsconfig/expo.json"],
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
}
```

`ios/`, `android/` and `.expo/` are ignored by both configs — but only if oxlint
actually loads those patterns, which is the whole reason Step 2 re-exports the
preset instead of extending it. A bare-RN or Expo repo that commits `ios/` and
`android/` is the case where this stops being invisible: `.gitignore` masks it
everywhere else. Everything under `app/` is exempt from
`import/no-default-export`, because expo-router routes are default exports by
contract.

### Bare React Native

Same as Expo but swap `expo` for `react-native` in both configs and use
`magic-tsconfig/base.json` with `"jsx": "react-jsx"`.

```ts
// oxlint.config.mts
export { default } from "magic-oxlint-config/react-native";
```

### React web (Vite, no framework)

Same as Next.js but swap `next` for `react` in both configs and use
`magic-tsconfig/base.json` with `"jsx": "react-jsx"` and `"lib": ["ES2022", "DOM", "DOM.Iterable"]`.

```ts
// oxlint.config.mts
export { default } from "magic-oxlint-config/react";
```

---

## pnpm 11

The root `package.json` pins `packageManager: pnpm@11.17.0`, and pnpm 11 changed
four things that every repo in this set hit during migration. None of them is a
magic defect; all of them are magic's to document, because magic is what pins the
version.

**Install scripts are gated, and `--frozen-lockfile` errors rather than warns.**
A fresh consumer with any native or download postinstall (esbuild, sharp,
puppeteer, @swc/core) gets `[ERR_PNPM_IGNORED_BUILDS]` and CI dies at the install
step. Declare them _before_ the first CI run, not after.

**`onlyBuiltDependencies` is now `allowBuilds`, and it is a map, not a list.**

```yaml
# pnpm-workspace.yaml — pnpm 11
allowBuilds:
  esbuild: true
  sharp: true
  "@swc/core": false
```

```jsonc
// package.json — pnpm 10, for comparison
{ "pnpm": { "onlyBuiltDependencies": ["esbuild", "sharp"] } }
```

pnpm rewrites `pnpm-workspace.yaml` on first install and appends placeholder
lines that look like config and are not:

```yaml
allowBuilds:
  "@swc/core": set this to true or false # NOT VALID — resolve it by hand
```

Leaving one in place breaks the next install.

**pnpm 11 ignores the `pnpm` field in `package.json`.** Settings move to
`pnpm-workspace.yaml`, which `pnpm install` auto-creates if it is missing.

**The 24h release quarantine will fail `--frozen-lockfile` on a fresh publish.**
pnpm 11 defaults `minimumReleaseAge` to 24 hours and enforces it on
`--frozen-lockfile`, so a repo that adopts magic within a day of a `magic-*`
release gets:

```
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 5 lockfile entries failed verification:
  magic-oxlint-config@1.0.0 / magic-oxfmt-config@1.0.0 / magic-tsconfig@1.0.0 / ...
```

pnpm auto-writes the escape hatch into `pnpm-workspace.yaml` on the first _local_
install. It reads like local-machine noise; it is not. **Commit it.**

```yaml
# pnpm-workspace.yaml
minimumReleaseAge: 4320 # 3 days, matching the shared Renovate preset
minimumReleaseAgeExclude:
  - magic-oxlint-config@1.0.0
  - magic-tsconfig@1.0.0
```

Delete the entries once the packages age past the window. The shared Renovate
preset sets `minimumReleaseAge: "3 days"` for the same reason from the other
side: without it Renovate automerges a same-day release that pnpm then refuses to
install, and CI goes red on a PR nobody touched and green again the next day.

**Vercel-deployed repos pin pnpm 10, not 11.** Vercel supports pnpm 6–10 and
picks the version from the lockfile's `lockfileVersion`; `packageManager` is only
consulted when Corepack is enabled, which is an `ENABLE_EXPERIMENTAL_COREPACK`
env var in the Vercel **project settings** — not something a repo can set from
its own files. So Vercel runs pnpm 9 or 10 against the `pnpm-workspace.yaml` that
pnpm 11 auto-created locally, finds no `packages` key, and fails with
`ERROR packages field missing or empty`. Pin `pnpm@10.34.5` and keep
`pnpm.overrides` / `pnpm.onlyBuiltDependencies` in `package.json`, where pnpm 10
still reads them.

**Stopping the ESLint tree coming back.** `magic-oxlint-config`'s two bundled JS
plugins declare a required `eslint` peer, and pnpm's default
`autoInstallPeers: true` honours it. Nothing runs eslint. To keep it out:

```yaml
# pnpm-workspace.yaml
peerDependencyRules:
  ignoreMissing:
    - eslint
```

---

## CI

```yaml
# .github/workflows/ci.yml in the consuming repo
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    uses: GSTJ/magic/.github/workflows/ci.yml@main
```

Everything is optional and overridable:

```yaml
jobs:
  ci:
    uses: GSTJ/magic/.github/workflows/ci.yml@main
    with:
      node-version: "22" # default: read .nvmrc from the caller
      test-command: pnpm run test # default: skipped
      build-command: pnpm run build # default: skipped
      extra-command: pnpm run doctor # escape hatch for repo-specific gates
      lint-command: "" # empty string skips the step
```

This repo is public, so private repos can call the workflow. It also calls
`ci.yml` on itself (`.github/workflows/self-ci.yml`), so a change that breaks
the reusable workflow fails here before it reaches a consumer.

For releases:

```yaml
jobs:
  release:
    uses: GSTJ/magic/.github/workflows/release.yml@main
    # Required. A called workflow can't exceed the caller's grant, and the
    # default GITHUB_TOKEN is read-only in new repos — without these the
    # version-bump push and the provenance publish both fail.
    permissions:
      contents: write
      id-token: write
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Renovate

```jsonc
// renovate.json in the consuming repo
{ "extends": ["github>GSTJ/magic"] }
```

That resolves to `default.json` at the root of this repo, which is where the
preset lives. Renovate deprecated serving a preset from `renovate.json`; this
repo's own `renovate.json` just extends the preset like everyone else's.

---

## Local overrides

The shared presets carry **general** guidelines only. Anything specific to one
repo — component conventions, architecture boundaries, service-layer rules —
belongs in that repo's own config, layered on top.

`extendConfig` merges the preset and your object into one flat config. Use it
rather than oxlint's `extends`: the result carries `ignorePatterns`, `plugins`
and `jsPlugins` at the top level, so there is nothing to forget.

```ts
// oxlint.config.mts
import reactNative from "magic-oxlint-config/react-native";
import { extendConfig } from "magic-oxlint-config";

export default extendConfig(reactNative, {
  rules: {
    // This repo has a PressableArea wrapper. Other repos don't, which is why
    // this lives here and not in the shared preset.
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "react-native",
            importNames: ["TouchableOpacity", "TouchableHighlight"],
            message:
              "Import { PressableArea } from '@/components/PressableArea' instead.",
          },
          {
            name: "react-native",
            importNames: ["Image"],
            message: "Import { Image } from '@/components/Image' instead.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["src/legacy/**"],
      rules: { "typescript/no-explicit-any": "off" },
    },
  ],
});
```

Multiple entries with the same `name` work and each keeps its own message —
that's why the ESLint config's `no-restricted-syntax` workaround is no longer
needed.

### Turning off a rule the preset sets inside its own override

This one is not guessable. The base preset enables the `jest` plugin **only**
inside its test-file override, and a rule belonging to a plugin that is not in an
override entry's own plugin set is silently ignored there. So this does nothing:

```ts
// no effect — the entry has no `plugins`, so `jest` is not enabled for it
overrides: [
  { files: ["**/*.test.ts"], rules: { "jest/valid-title": "off" } },
],
```

and neither does a top-level `rules: { "jest/valid-title": "off" }`, which loses
to the preset's override on the same files. Repeat the plugin list — exported so
you do not have to retype it and cannot get it out of sync:

```ts
import { extendConfig, testFilePlugins } from "magic-oxlint-config";
import base from "magic-oxlint-config/base";

export default extendConfig(base, {
  overrides: [
    {
      files: ["**/*.test.ts"],
      plugins: testFilePlugins, // ["typescript","unicorn","oxc","import","promise","jest"]
      rules: { "jest/valid-title": "off" },
    },
  ],
});
```

`fixtures/adversarial/override` runs both shapes on every `pnpm run check`, so
this stays true or the build says so.

### vitest repos

The presets declare the `jest` plugin, not `vitest` — the rule sets overlap
almost entirely and `jest/*` fires on `vi.mock` and friends. Two consequences
worth knowing before running any autofix:

- `jest/*` **suggestions** emit jest-shaped code. `jest/no-untyped-mock-factory`
  writes `vi.mock<typeof import("x")>("x", factory)`, which is jest's signature;
  vitest 4 declares `mock(path, factory?)` and `mock<T>(module: Promise<T>, …)`,
  so an explicit type argument rules the string overload out and none of it
  typechecks. See the `--fix-suggestions` gotcha below.
- To swap the plugin, re-declare the test-file override with
  `plugins: [...testFilePlugins.filter((p) => p !== "jest"), "vitest"]` and the
  `vitest/*` names you want. There is no `vitest` variant shipped yet
  (DECISIONS.md §4).

E2E suites are another local-override case. The presets' test globs only match
`*.test.*` / `*.spec.*` / `__tests__`, so Playwright / Maestro / Detox specs in
an `e2e/` directory get the full strict set — `no-console`, `func-style`, and
(under `--type-aware`) every type-aware rule. Repos with an e2e directory
should add their own override:

```ts
overrides: [
  {
    files: ["e2e/**"],
    rules: { "no-console": "off", "func-style": "off" },
  },
],
```

## Kebab-case filenames

`unicorn/filename-case` is on at `kebabCase` in every preset, so adopting `base`
in an existing repo means renaming `Button.tsx` to `button.tsx` and fixing every
import that pointed at it. `magic-codemods` does both.

```sh
pnpm add -D magic-codemods

# 1. Clean tree. The codemod refuses to run otherwise, and means it.
git status

# 2. Read the plan. Changes nothing.
pnpm exec magic-kebab --dry-run

# 3. Apply.
pnpm exec magic-kebab --write

# 4. Verify, then commit the renames on their own.
pnpm exec tsc --noEmit && pnpm run lint && pnpm run test
git add -A && git commit -m "refactor: kebab-case filenames"
```

Commit renames separately from anything else. `git log --follow` survives this
because git infers renames from content similarity at diff time, and a
rename-only commit gives it the easiest possible job.

`--dry-run` prints three sections that are not decoration:

- **SKIPPED** — files the linter reported that the codemod refuses to rename,
  with the reason. Route parameters, package mocks, the RN entry point.
- **NEEDS REVIEW** — `moduleNameMapper` regexes, computed `import()` specifiers,
  `package.json` `exports`, docs, **bare string literals that resolve to a file
  being renamed** (Expo config plugins, require-wrapper arguments, route
  manifests), and **path aliases nothing could resolve**. Found and printed,
  never edited, because guessing at any of them turns a lint fix into an outage.
  `--strict` exits non-zero on anything in this section; in a monorepo, use it.
- **CONFLICTS** — two files that want the same name, or a target that would still
  violate the rule. Nothing is renamed for these; resolve them with `--rename`.

Filenames that are a framework contract are exempt in the presets themselves, not
by convention or vigilance:

| Pattern                        | Exempted by                    | Why                                                                                      |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `[postId].tsx`, `[[...x]].tsx` | `ignore` in `base`             | The brackets hold a route parameter name. `params.postId` is not `params.post-id`.       |
| `__mocks__/AsyncStorage.ts`    | `__mocks__` override in `base` | jest/vitest match the filename against the _package_ being mocked.                       |
| `App.tsx`                      | `react-native` and `expo`      | Bare RN's `index.js` and Expo's `AppEntry.js` import `./App` from inside `node_modules`. |

Everything else you might worry about already passes on its own: `page.tsx`,
`layout.tsx`, `not-found.tsx`, `route.ts`, `middleware.ts`, `_app.tsx`,
`_document.tsx`, `_layout.tsx`, `+not-found.tsx`. Route groups `(marketing)` and
parallel routes `@modal` are directories, and the rule only looks at basenames.

Remix / React Router file routes (`$postId.tsx`) are not exempt — nothing in the
migration set uses them. Add `ignore: ["^\\$"]` locally if yours does.

Renaming `Button.tsx` to `button.tsx` does not change how it is imported:
`import { Button } from "./button"` and `import Button from "./button"` both work
unchanged. Only the specifier moves.

Two things to know before running it in a monorepo:

- **`--tsconfig` is repeatable, and discovery now walks the workspace.** The
  resolver reads `paths` from the repo root, from every package matched by
  `pnpm-workspace.yaml`, and from a generic `*/tsconfig.json` sweep. It used to
  look only at the run root — which in a monorepo usually has no tsconfig — print
  `tsconfig: (none found)`, and rewrite relative imports while leaving every
  `@/…` alias pointing at a file it had just renamed. If an alias still cannot be
  resolved it lands under NEEDS REVIEW rather than being skipped quietly.
- **`--rename` keys are full basenames, extension included.**
  `--rename zodI18n.ts=zod-i18n.ts`, not `--rename zodI18n=zod-i18n`. The short
  form is now an error; it used to be accepted, ignored, and the file renamed to
  the codemod's own target instead.

See the [codemods README](packages/codemods) for the full option list.

## Opt-in rules

`magic-oxlint-plugin` ships seven rules. None is on by default anywhere — pick
the ones a given repo wants.

```sh
pnpm add -D magic-oxlint-plugin
```

```ts
// oxlint.config.mts — complete file, imports included
import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
  rules: {
    "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
    "magic/no-ancestor-directory-import": "error",
    "magic/no-barrel-file": "error",
    "magic/no-module-mocks": "error",
    "magic/prefer-suspense-query": ["error", { roots: ["api", "trpc"] }],
    // React repos only.
    "magic/react-require-autocomplete": "error",
    "magic/react-hooks-strict-return": "error",
  },
});
```

See the [plugin README](packages/oxlint-plugin) for what each one does.

### Coming from `@shopify/eslint-plugin`

Four of those rules are ports of Shopify rules; four more Shopify rules have a
native oxlint equivalent and need config rather than a plugin. Loading
`@shopify/eslint-plugin` itself as a jsPlugin works for six of its eight rules,
but pulls 262 packages and 97 MB of the ESLint ecosystem back into a repo that
just left it — so nothing here depends on it. The plugin README has the measured
compatibility matrix, the per-rule disposition, and the copy-paste config for
`restrict-full-import`, `jsx-no-hardcoded-content` and
`strict-component-boundaries`.

## Type-aware linting

The presets already contain every type-aware rule, configured. They do nothing
until you pass the flag — oxlint ignores type-aware rules silently when it isn't
running in type-aware mode, so there is no cost to leaving them in.

To switch a repo on:

```sh
pnpm add -D oxlint-tsgolint
```

```jsonc
{ "scripts": { "lint": "oxlint --type-aware" } }
```

Requirements, all of which have to be true:

- **The `oxlint-tsgolint` optional peer, and nothing else.** The repo's own
  `typescript` version is irrelevant: tsgolint embeds typescript-go and never
  reads the installed compiler. Verified firing under `typescript@6.0.3`. An
  earlier version of this document claimed TypeScript 7 was a floor; it was
  inferred from "built on typescript-go" rather than tested, and that phrase is
  in fact the reason it does not matter.
- **Do not install `typescript@7.0.2` just for this.** It breaks
  `next@15.5.19`: loading `next.config.ts` dies with
  `TypeError: Cannot read properties of undefined (reading 'fileExists')`, and
  converting that file to `.mjs` then makes Next silently stop resolving tsconfig
  `paths` (`Can't resolve '@/lib/format'`).
- **No `baseUrl` in tsconfig.** Not supported. Use `paths` alone.
- **In a monorepo, `pnpm -r build` first.** Type-aware linting reads `.d.ts`
  from dependency packages, so they have to exist.
- **Don't leave `"include": ["**/*"]` in a root tsconfig.** It makes the whole
  run crawl. Scope it, or use `"files": []` at the monorepo root.

Profile with `oxlint --type-aware --debug timings` if it feels slow; the output
labels each rule `native` or `type-aware`.

---

## Gotchas

Things that cost real time to discover. Read these before migrating a repo.

**A nested config silently beats the root's `ignorePatterns`.** oxlint walks up
from each file and uses the nearest config it finds. If a subdirectory has its
own `oxlint.config.mts` or `.oxlintrc.json`, files under it use that config and
the root's ignore patterns never apply. Pass `--disable-nested-config` at the
monorepo root unless you specifically want per-package configs.

**A case-only rename is a no-op on macOS.** APFS is case-insensitive by default,
so `Button.tsx` and `button.tsx` are the same path. `git mv` between them is
refused, or with `-f` updates the index while leaving the file alone — you get a
commit claiming a rename that never happened, and a file that only materialises
when someone checks out on Linux. `magic-kebab` always renames through a third
name for this reason. If you are doing it by hand, do the same.

**Scoping a lint run with `-D` throws away that rule's options.** Verified on
1.75.0: `oxlint -A all -D unicorn/filename-case` re-enables the rule with its
_default_ configuration, so the `ignore` list in your config stops applying and
every `[postId].tsx` gets reported. `overrides` survive it, rule options do not.
There is no way to ask oxlint about one rule and keep its config; run it plainly
and filter the JSON.

**An unknown rule name is fatal.** oxlint refuses to start:
`x Rule 'jsx-no-leaked-render' not found in plugin 'react'`. Rules do get
removed between minors. If a config that worked yesterday won't load, an oxlint
bump renamed something.

**`extends` in `.oxlintrc.json` is a file path, not a package name.**
`"extends": ["magic-oxlint-config/react.json"]` does not resolve through
node_modules — oxlint joins it onto the config's own directory and reports a
missing file. JSON consumers must write
`"extends": ["./node_modules/magic-oxlint-config/react.json"]`. Prefer
`oxlint.config.mts`, where `extends` takes imported objects and resolution just
works. (`jsPlugins`, confusingly, _does_ do real node resolution — it's only
`extends` that doesn't.)

**`overrides[].plugins` replaces the top-level list, it does not merge.** An
override that sets `plugins: ["jest"]` turns _off_ typescript, unicorn and
import for those files. The base preset repeats the full list in its test-file
override for exactly this reason.

**...and the consequence: a rule you explicitly turn off in an override can stay
on.** A plugin enabled _only_ inside an override is not enabled for any other
override entry, and a rule from a plugin that entry does not have is ignored —
silently. So a consumer entry with `rules: { "jest/no-untyped-mock-factory":
"off" }` and no `plugins` key has no effect at all, and neither does a top-level
`rules` entry (that one loses to the preset's override on the same files). Adding
the full plugin list to your own entry is what makes it work:

```ts
// no effect
{ files: ["**/*.test.ts"], rules: { "jest/no-untyped-mock-factory": "off" } }

// works
{
  files: ["**/*.test.ts"],
  plugins: ["typescript", "unicorn", "oxc", "import", "promise", "jest"],
  rules: { "jest/no-untyped-mock-factory": "off" },
}
```

`magic-oxlint-config` exports that array as `testFilePlugins` — see
[Local overrides](#local-overrides).

**A doc comment glued to the first import travels with it when sorting.** Put a
blank line between a file-level comment block and the first `import`, or the
formatter will carry the comment down the file with whichever import it was
attached to.

**oxfmt has no `extends`, and writing one is silently ignored.** No error, no
warning — the key is simply not in the schema. This is why sharing goes through
`oxfmt.config.mts` importing a package, not through config inheritance.

**oxfmt's default `printWidth` is 100, not Prettier's 80.** We set 80
explicitly. A config that forgets to reflows every file in the repo.

**oxfmt sorts `package.json` keys by default.** Expected and kept, but it means
the first `oxfmt .` produces a large, harmless diff in every manifest.

**There is no `.oxfmtignore`.** oxfmt honours `.gitignore` and `.prettierignore`
plus the config's own `ignorePatterns`. A `.oxfmtignore` file does nothing.

**`no-restricted-syntax` doesn't exist in oxlint.** The three things it was
used for map to real rules: `no-restricted-properties` for the `process.env`
ban, `no-restricted-imports` for restricted imports, and the statement bans
(`ForInStatement`, `LabeledStatement`, `WithStatement`) land on `guard-for-in`,
`no-labels` and `no-with`. One deliberate relaxation in that last group: the
old config banned `for..in` outright, `guard-for-in` accepts a
`hasOwnProperty`-guarded loop.

**`oxlint --fix` can need two passes.** Some fixes cascade: safe-jsx rewrites
`items.length && <li/>` to `Boolean(items.length) &&`, which
`unicorn/explicit-length-check` then rewrites to `items.length > 0 &&`. Run
`--fix` until the diff is empty (two passes in practice) before reading the
result. And read the `Boolean(...)` rewrites specifically: `Boolean(x)` does
**not** narrow, so `{toast && <Toast {...toast} />}` becoming
`{Boolean(toast) && <Toast {...toast} />}` leaves the spread typed
`ToastPayload | null` and `tsc` fails with TS2322 several files away from
anything the diff touched. `toast !== null &&` satisfies the same rule and
narrows correctly.

**Do not run `--fix-suggestions` (or `--fix-dangerously`) blind.** The flag is
not `--fix` with more coverage. Suggestions are suggestions precisely because
they change semantics or tighten types past what the code satisfies, and two of
them are actively destructive on oxlint 1.75.0:

- `unicorn/prefer-export-from` collapses everything between the first and last
  re-export in a module into one `export … from` statement, **deleting** any
  `export const` or `export type` that sat in between. No diagnostic, no type
  error at the fix site. One repo caught it only because two tests asserted on a
  value that became `undefined`; in the same run another file went from 39
  exported names to 3. The preset now ships this rule `"off"` —
  `fixtures/adversarial/base/src/derived-reexport.ts` asserts the shape survives.
- `jest/*` suggestions rewrite tests onto stricter APIs (`jest.spyOn`,
  `jest.mocked`, `toStrictEqual`, typed mock factories) whose tightened typing
  the existing partial mocks do not satisfy — ~25 fresh `tsc` errors in one repo,
  and under vitest every one of them was wrong (see the vitest note in
  [Local overrides](#local-overrides)).

If you do run it, diff the exported names of every file it touched, before and
after.

**`--report-unused-disable-directives` lies about multi-rule directives.** Given
`/* eslint-disable no-bitwise, operator-assignment, unicorn/number-literal-case */`
where only the last rule is unused, oxlint 1.75.0 reports
`Unused eslint-disable directive (no problems were reported)` — naming no rule,
about the whole directive. Deleting it on that basis produced 8 real errors.
Remove rule names one at a time until the warning clears, or delete it and read
what appears.

## Development

```sh
pnpm install
pnpm run check   # build, validate rules, lint, format, typecheck, test, smoke
```

`pnpm run smoke` lints `fixtures/smoke` — a deliberately broken file — and
asserts on exactly which rules fire. If a config change stops catching leaked
`&&` JSX or `process.env` access, that's where it fails.

`pnpm run validate-rules` checks every rule name in every preset against
oxlint's own shipped JSON schema. Run it after any oxlint bump.

`pnpm run adversarial` runs `fixtures/adversarial` — end-to-end
expected-outcome checks against the real binaries: every emitted variant on a
clean file, the opt-in plugin rules, the README's restricted-imports snippet,
safe-jsx's autofix convergence, and oxfmt's import-sort edge cases.
