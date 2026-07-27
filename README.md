# magic

Shared tooling for GSTJ projects. One place for lint, format, TypeScript config,
CI workflows and Renovate settings, so twelve repos stop each having their own
slightly-wrong version.

| Package                                         | What it is                                                      |
| ----------------------------------------------- | --------------------------------------------------------------- |
| [`magic-oxlint-config`](packages/oxlint-config) | oxlint presets: `base`, `react`, `react-native`, `next`, `expo` |
| [`magic-oxfmt-config`](packages/oxfmt-config)   | oxfmt config, including the import sort order                   |
| [`magic-oxlint-plugin`](packages/oxlint-plugin) | Four opt-in lint rules with no oxlint equivalent                |
| [`magic-tsconfig`](packages/tsconfig)           | `base`, `internal-package`, `nextjs`, `expo` TypeScript bases   |
| `.github/workflows/ci.yml`                      | Reusable `workflow_call` job: install, lint, format, typecheck  |
| `.github/workflows/release.yml`                 | Reusable `workflow_call` job: build and publish to npm          |
| `default.json`                                  | Renovate preset, consumable as `github>GSTJ/magic`              |

ESLint and Prettier are gone. oxlint replaces ESLint, oxfmt replaces Prettier
**and** `@ianvs/prettier-plugin-sort-imports`.

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
import base from "magic-oxlint-config/base"; // plain TypeScript / Node / library
// import react from "magic-oxlint-config/react";               // React web, no framework
// import next from "magic-oxlint-config/next";                 // Next.js
// import reactNative from "magic-oxlint-config/react-native";  // bare React Native
// import expo from "magic-oxlint-config/expo";                 // Expo
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
});
```

That's the whole file. Repo-specific rules go in the same object — see
[Local overrides](#local-overrides).

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
behave identically in oxfmt, but the second form trips
`unicorn/prefer-export-from` in the lint preset shipped alongside it, so
`pnpm run lint` would fail on the file this README told you to write. If the
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
import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

export default defineConfig({ extends: [base] });
```

```ts
// oxfmt.config.mts
export { default } from "magic-oxfmt-config";
```

```jsonc
// tsconfig.json
{
  "extends": "magic-tsconfig/internal-package.json",
  "include": ["src"],
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    // Required under TypeScript 7 (tsgo): auto-inclusion of @types packages
    // does not kick in with this config shape, so `process` and `node:*`
    // imports fail typecheck without it. Verified against tsgo 7.0.2.
    "types": ["node"],
  },
}
```

### Next.js

```sh
pnpm add -D oxlint@1.75.0 oxfmt@0.60.0 magic-oxlint-config magic-oxfmt-config magic-tsconfig
pnpm remove eslint eslint-config-next @next/eslint-plugin-next prettier
```

```ts
// oxlint.config.mts
import next from "magic-oxlint-config/next";
import { defineConfig } from "oxlint";

export default defineConfig({ extends: [next] });
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

The `next` preset already relaxes `import/no-default-export` and `func-style`
for App Router file conventions (`page.tsx`, `layout.tsx`, `route.ts`,
`middleware.ts`, `sitemap.ts`, and the rest), so those files need no local
exceptions.

### Expo

```sh
pnpm add -D oxlint@1.75.0 oxfmt@0.60.0 magic-oxlint-config magic-oxfmt-config magic-tsconfig
pnpm remove eslint eslint-config-expo prettier
```

```ts
// oxlint.config.mts
import expo from "magic-oxlint-config/expo";
import { defineConfig } from "oxlint";

export default defineConfig({ extends: [expo] });
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

`ios/`, `android/` and `.expo/` are already ignored by both configs. Everything
under `app/` is exempt from `import/no-default-export`, because expo-router
routes are default exports by contract.

### Bare React Native

Same as Expo but swap `expo` for `react-native` in both configs and use
`magic-tsconfig/base.json` with `"jsx": "react-jsx"`.

### React web (Vite, no framework)

Same as Next.js but swap `next` for `react` in both configs and use
`magic-tsconfig/base.json` with `"jsx": "react-jsx"` and `"lib": ["ES2022", "DOM", "DOM.Iterable"]`.

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

```ts
// oxlint.config.mts
import reactNative from "magic-oxlint-config/react-native";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [reactNative],
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

## Opt-in rules

`magic-oxlint-plugin` ships four rules. None is on by default anywhere.

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
    "magic/no-barrel-file": "error",
    "magic/no-module-mocks": "error",
    "magic/prefer-suspense-query": ["error", { roots: ["api", "trpc"] }],
  },
});
```

See the [plugin README](packages/oxlint-plugin) for what each one does.

## Type-aware linting

The presets already contain every type-aware rule, configured. They do nothing
until you pass the flag — oxlint ignores type-aware rules silently when it isn't
running in type-aware mode, so there is no cost to leaving them in.

To switch a repo on:

```sh
pnpm add -D oxlint-tsgolint typescript@^7
```

```jsonc
{ "scripts": { "lint": "oxlint --type-aware" } }
```

Requirements, all of which have to be true:

- **TypeScript 7.0 or newer.** `oxlint-tsgolint` is built on typescript-go.
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
result.

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
