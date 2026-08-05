# magic

Shared tooling for GSTJ projects. One place for lint, format, TypeScript config,
CI workflows and Renovate settings, so twelve repos stop each having their own
slightly-wrong version.

| Package                                         | What it is                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| [`magic-oxlint-config`](packages/oxlint-config) | oxlint presets: `base`, `react`, `react-native`, `next`, `expo`   |
| [`magic-oxfmt-config`](packages/oxfmt-config)   | oxfmt config, including the import sort order                     |
| [`magic-oxlint-plugin`](packages/oxlint-plugin) | Eight opt-in lint rules with no oxlint equivalent                 |
| [`magic-tsconfig`](packages/tsconfig)           | `base`, `internal-package`, `nextjs`, `expo` TypeScript bases     |
| [`magic-codemods`](packages/codemods)           | `magic-kebab`: the kebab-case filename migration                  |
| [`magic-observability`](packages/observability) | PostHog init, `captureError`, error boundary, per-platform        |
| [`magic-docs`](packages/docs)                   | Fumadocs theme, layout/MDX presets, TypeScript reference, Pages   |
| `GSTJ/magic/docs-landing`                       | Editable shadcn block for dark package landing pages              |
| `.github/workflows/ci.yml`                      | Reusable `workflow_call` job: install, lint, format, typecheck    |
| `.github/workflows/release.yml`                 | Reusable `workflow_call` job: build and publish to npm            |
| `.github/workflows/e2e-ios.yml`                 | Reusable `workflow_call` job: Maestro iOS E2E, optionally sharded |
| `.github/actions/setup`                         | Composite: Node + pnpm, store cache on, frozen install            |
| `.github/actions/setup-ios-e2e`                 | Composite: Xcode, Maestro, CocoaPods, a booted simulator          |
| `.github/actions/build-ios-app`                 | Composite: prebuild, pods, `xcodebuild`, and the caches           |
| `.github/actions/run-maestro`                   | Composite: install, launch, run the flows, report, upload         |
| `.github/actions/approve-parked-ci`             | Composite: release the `action_required` runs on a bot PR         |
| `default.json`                                  | Renovate preset, consumable as `github>GSTJ/magic`                |

ESLint and Prettier no longer _run_ anywhere: oxlint replaces ESLint, oxfmt
replaces Prettier **and** `@ianvs/prettier-plugin-sort-imports`.

`eslint` no longer comes back into the tree either, as of
`magic-oxlint-config@2.0.0`. It used to: the two ESLint plugins oxlint loaded as
JS plugins both declared a **required** `eslint` peer, and pnpm's default
`autoInstallPeers` honoured it, so installing the config pulled eslint 9 and its
`minimatch@3` -> `brace-expansion@1` tail into repos that never run eslint. The
four `react-native` rules are now ported into `magic-oxlint-plugin`, and
`eslint-plugin-safe-jsx` marked its peer optional upstream. A fresh
`npm i magic-oxlint-config` adds 3 packages where it used to add 90, and `npm
audit` reports nothing where it used to report 5 highs. See DECISIONS.md §4.

---

## Docs landing block

`docs-landing` is the editable landing layer for `magic-docs`. It installs the
shell, section primitives, clipboard button, scoped CSS, and GSAP effects into
the consumer repo. Each package supplies its product demo, examples, history,
and copy.

```sh
pnpm dlx shadcn@latest add GSTJ/magic/docs-landing
```

Add `--dry-run` to see the file list without writing anything, and
`#some-branch` to install from a branch instead of `main`.

```text
components/docs-landing/
|-- docs-landing.tsx
|-- docs-landing-effects.tsx
|-- docs-landing.module.css
`-- install-command.tsx
```

The CLI resolves `@components` from `components.json` and installs
`gsap@3.15.0`.

The GitHub address reads `registry.json` and the source files straight from the
repo. `public/r/registry.json` and `public/r/docs-landing.json` are the flat
payloads built by shadcn, for the HTTPS address the Registry Directory will
need. `pnpm run validate-registry` checks their metadata, file list, and
embedded source against `registry.json` and the four files above.

Nothing here is a package, so nothing compiles it as a side effect of a build.
`registry/tsconfig.json` extends `magic-tsconfig/nextjs` and `pnpm run
typecheck` runs it, which is what stops these four files rotting between
releases.

### Registry Directory status

`@magic/docs-landing` is reserved for the shadcn Registry Directory. It becomes
eligible after this work merges, the files under `public/r` have a stable public
HTTPS URL, and the namespace is accepted upstream. Use the GitHub addresses
above during PR review and until that directory entry ships.

Compose the page around repository-owned content:

```tsx
import {
  DocsDemoFrame,
  DocsHero,
  DocsLanding,
  DocsSection,
  DocsStatStrip,
} from "@/components/docs-landing/docs-landing";

export default function LandingPage() {
  return (
    <DocsLanding
      name={site.name}
      navigation={site.navigation}
      repository={{ href: site.repository, label: "GitHub" }}
      version={site.version}
    >
      <DocsHero
        actions={hero.actions}
        description={hero.description}
        eyebrow={hero.eyebrow}
        installCommand={site.installCommand}
        title={hero.title}
        visual={<ProductDemo />}
      />
      <DocsStatStrip items={projectStats} />
      <DocsSection
        description={example.description}
        eyebrow={example.eyebrow}
        index="01"
        title={example.title}
        tone="blue"
      >
        <DocsDemoFrame label={example.label}>
          <ProductExample />
        </DocsDemoFrame>
      </DocsSection>
    </DocsLanding>
  );
}
```

The shell defaults to dark. Set its `--docs-*` variables with the `style` prop
or a wrapper class. Motion is scoped to the landing root, cleans up on unmount,
and stays off when the visitor requests reduced motion.

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

That's the whole file. Re-exporting means oxlint loads the preset as _the_
config, so every field applies. Repo-specific rules go through `extendConfig`,
which flattens the preset and your object into one config — see
[Local overrides](#local-overrides). Those two forms are the whole supported
surface; there is no third.

> ### ⚠️ Never consume a preset through oxlint's `extends`
>
> `defineConfig({ extends: [base] })` loses the preset's **`ignorePatterns`**,
> and a local `ignorePatterns` array **replaces** rather than supplements them.
> On oxlint 1.75.0 with no `.gitignore` in the way, that config reported ~500k
> diagnostics out of `node_modules`; with one, it silently linted `generated/`,
> `ios/` and `android/` — the directories bare RN and Expo repos commit.
>
> Everything else does travel: severities, rule **options**, `categories`,
> `plugins`, `jsPlugins`, `overrides`, and — since `magic-oxlint-config` 1.2.0 —
> `env` and `globals`, which the presets now mirror into a `files: ["**"]`
> override because overrides survive `extends` and top-level fields do not.
> `ignorePatterns` is the one that cannot be defended: oxlint has no per-override
> ignore.
>
> `ignorePatterns: base.ignorePatterns` does restore them, and this README
> documented that recipe up to 1.1.0. It is gone: it is a line you have to
> remember in every repo, on every variant, forever, and forgetting it is
> invisible until the day someone edits `.gitignore`. Seven of the eleven repos
> that migrated onto 1.0.0 shipped a config with **zero** ignore patterns.
>
> **Do not verify any of this with `oxlint --print-config`** — see
> [Gotchas](#gotchas). Under `extends` it prints `categories: {}`,
> `env: {builtin: true}`, `globals: {}` and every rule stripped of its options,
> all of which are wrong about what is running. Lint a file instead.
>
> `.oxlintrc.json` consumers have no `extendConfig` and must use `extends`; they
> copy the ignore list literally. See the
> [package README](packages/oxlint-config#json-consumers).

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

Add `*.tsbuildinfo` to `.gitignore` if the repo ever turns `incremental` on.
`base.json`, `internal-package.json` and `expo.json` do not (a base that
publishable packages extend has no business carrying build-cache state), but a
repo that opts in gets one written next to every tsconfig — and if it lands
_outside_ `outDir`, `rimraf dist && tsc` emits nothing on the second run, exit 0,
no output, no error. Scope it: `"tsBuildInfoFile": "dist/.tsbuildinfo"`.

The two settings are a pair, in both directions. A `tsBuildInfoFile` left behind
without `incremental` is `error TS5069` on TypeScript 5.x — a hard typecheck
failure on the bump alone. (tsgo 7.0.2 accepts it; 5.4.5 does not.)
`magic-tsconfig/nextjs.json` is the one variant that keeps `incremental`, for a
reason that has nothing to do with build caches — see the Next.js section.

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

Keep `*.tsbuildinfo` in `.gitignore` here. `magic-tsconfig/nextjs.json` sets
`incremental: true` — not for the cache, but because `next build` writes any of
its suggested compiler options that are missing from the _resolved_ config
straight into your `tsconfig.json`, reformatting the whole file as it goes. Leave
`incremental` unset and every build dirties the working tree and fails the next
`oxfmt --check` on a file nobody edited. Next keeps its own build info in
`.next/cache`; the stray `tsconfig.tsbuildinfo` comes from your own
`tsc --noEmit`.

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

**The release quarantine applies to `--frozen-lockfile` too.** pnpm 11 defaults
`minimumReleaseAge` to 24 hours. GSTJ consumers raise that to 14 days and pnpm
enforces it on `--frozen-lockfile`, so a repo that adopts a dependency inside
that window gets:

```
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 5 lockfile entries failed verification:
  magic-oxlint-config@1.0.0 / magic-oxfmt-config@1.0.0 / magic-tsconfig@1.0.0 / ...
```

pnpm auto-writes the escape hatch into `pnpm-workspace.yaml` on the first _local_
install. It reads like local-machine noise; it is not. **Commit it.**

```yaml
# pnpm-workspace.yaml
minimumReleaseAge: 20160 # 14 days, matching the shared Renovate preset
minimumReleaseAgeExclude:
  - "magic-*" # first-party packages published from GSTJ/magic
```

Delete the entries once the packages age past the window. The shared Renovate
preset sets `minimumReleaseAge: "14 days"` for the same reason from the other
side. It requires registry timestamps and does not create the branch until the
window clears. Vulnerability-alert PRs use the same quarantine.

`GSTJ/magic` itself is the explicit first-party exception. Its `renovate.json`
sets the age to `0 days` and its workspace sets `minimumReleaseAge: 0`, so this
repo can move immediately. That exception does not flow into consumers.

**Upgrading inside the window needs BOTH versions listed, briefly.** This is the
step everyone gets wrong, because the obvious edit — bump `package.json` to
`^1.2.0`, change the exclude entries to `@1.2.0`, install — fails on the versions
you are _leaving_:

```
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 4 lockfile entries failed verification:
  magic-codemods@1.1.0 was published at …, within the minimumReleaseAge cutoff
```

pnpm verifies the **committed lockfile** against the policy before it resolves
anything, so the old versions have to stay excluded for the one install that
rewrites the lockfile. It also suggests `pnpm clean --lockfile`, which is a far
bigger hammer than the situation needs. The sequence that works:

```yaml
# 1. list both, for one install
minimumReleaseAgeExclude:
  - magic-oxlint-config@1.1.0
  - magic-oxlint-config@1.2.0
```

```sh
pnpm install                    # rewrites the lockfile onto 1.2.0
# 2. delete the @1.1.0 lines
pnpm install --frozen-lockfile  # confirms; no-op
```

Other entries stay version-pinned: adopting a same-day third-party release is a
decision worth being explicit about, and an unpinned exclusion silently stays
true for every future release. `magic-*` is deliberately unpinned because it is
the first-party exception.

**`pnpm dedupe --check` is not read-only.** On 11.17.0 it runs a full resolution
and prunes packages out of `node_modules`, after which
`pnpm install --frozen-lockfile` reports "Already up to date" against an
incomplete tree and only `rm -rf node_modules` recovers it. Fine as its own CI
job; do not put it in front of a build in the same one.

**A quarantined `pnpm install` downgrades rather than failing, and says
nothing.** With the policy active, pnpm resolves _around_ anything inside the
window: one upgrade turned `bunchee` 6.12.1 into 6.12.0 and dropped a transitive
dependency entirely, producing a 253-line lockfile diff where 26 were expected.
Read the lockfile diff before committing it. If it has moved packages unrelated
to what you changed, revert it and re-resolve.

**Vercel-deployed repos pin pnpm 10, not 11.** Vercel supports pnpm 6–10 and
picks the version from the lockfile's `lockfileVersion`; `packageManager` is only
consulted when Corepack is enabled, which is an `ENABLE_EXPERIMENTAL_COREPACK`
env var in the Vercel **project settings** — not something a repo can set from
its own files. So Vercel runs pnpm 9 or 10 against the `pnpm-workspace.yaml` that
pnpm 11 auto-created locally, finds no `packages` key, and fails with
`ERROR packages field missing or empty`. Pin `pnpm@10.34.5` and keep
`pnpm.overrides` / `pnpm.onlyBuiltDependencies` in `package.json`, where pnpm 10
still reads them.

pnpm 10.34.5 prints a warning on every invocation, including `pnpm --version`,
saying it no longer does:

```
[WARN] The "pnpm" field in package.json is no longer read by pnpm.
       The following keys were ignored: "pnpm.overrides", "pnpm.onlyBuiltDependencies"
```

Observed behaviour contradicts it — installs still honour the overrides and the
lockfile's `overrides:` block survives byte-identical — but it is a warning about
a removal that is coming. Do not "fix" it by moving the settings into
`pnpm-workspace.yaml`: that file without a `packages` key is exactly what breaks
Vercel's pnpm. If you add one, give it `packages:`.

**The ESLint tree that used to come back.** `magic-oxlint-config@1.2.0` and
earlier depended on two ESLint plugins with a required `eslint` peer, and pnpm's
default `autoInstallPeers: true` honoured it even though nothing runs eslint.
`2.0.0` ends it at the source: the four `react-native` rules moved into
`magic-oxlint-plugin`, which has no dependencies, and `eslint-plugin-safe-jsx`
shipped the optional peer upstream in 1.3.2. Measured on a fresh install into an
empty project:

|                                 | `magic-oxlint-config@1.2.0` | `@2.0.0` |
| ------------------------------- | --------------------------- | -------- |
| `npm i`, packages added         | 90                          | 3        |
| `.pnpm` directories             | 90                          | 3        |
| `eslint`                        | 9.39.5                      | absent   |
| `minimatch` / `brace-expansion` | 3.1.5 / 1.1.16              | absent   |
| `npm audit`                     | 5 high                      | 0        |

No `packageExtensions` stanza, no `overrides`, nothing for a consumer to add.

**If you are still on `magic-oxlint-config@1.2.0` or earlier**, the mitigations
below still apply, and nothing below this line is needed on 2.0.0. On pnpm, mark
the peer optional:

```yaml
# pnpm-workspace.yaml
packageExtensions:
  eslint-plugin-safe-jsx:
    peerDependenciesMeta:
      eslint:
        optional: true
  eslint-plugin-react-native:
    peerDependenciesMeta:
      eslint:
        optional: true
```

`peerDependencyRules.ignoreMissing` does **not** do this: on pnpm 11.17.0 it
silences the missing-peer warning and installs eslint anyway, byte-identical
lockfile with and without it.

On npm or yarn there is no `packageExtensions`, and a required peer is installed
whatever you do, so pin the major instead:

```jsonc
// package.json — npm
{ "overrides": { "eslint": "^10" } }
// package.json — yarn
{ "resolutions": { "eslint": "^10" } }
```

That took a fresh `npm i magic-oxlint-config@1.2.0` from 78 packages and
`brace-expansion@1.1.16` to 62 and `5.0.8`. It worked because
`eslint-plugin-react-native@5.0.0` capped its peer at `^9`, and eslint 9 is the
last major carrying `@eslint/eslintrc` and a `@eslint/config-array` on
`minimatch@3`, which is the `brace-expansion@1` tail with no v1 fix.

None of it addresses a repo that depends on something with a real `eslint`
dependency — `expo-module-scripts` is the one in this set. Check `pnpm why
eslint` before assuming the upgrade cleared it.

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
    uses: GSTJ/magic/.github/workflows/ci.yml@v1
```

Everything is optional and overridable:

```yaml
jobs:
  ci:
    uses: GSTJ/magic/.github/workflows/ci.yml@v1
    with:
      node-version: "22" # default: read .nvmrc from the caller
      test-command: pnpm run test # default: skipped
      build-command: pnpm run build # default: skipped
      extra-command: pnpm run doctor # escape hatch for repo-specific gates
      lint-command: "" # empty string skips the step
      job-name: verify # second half of the reported check context
```

This repo is public, so private repos can call the workflow. It also calls
`ci.yml` on itself (`.github/workflows/self-ci.yml`), so a change that breaks
the reusable workflow fails here before it reaches a consumer.

For releases:

```yaml
jobs:
  release:
    uses: GSTJ/magic/.github/workflows/release.yml@v1
    # Required. A called workflow can't exceed the caller's grant, and the
    # default GITHUB_TOKEN is read-only in new repos — without these the
    # version-bump push and the provenance publish both fail.
    permissions:
      contents: write
      id-token: write
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Versions, and why never `@main`

Every workflow and action here is consumed by tag:

| Ref       | What it does                                                      |
| --------- | ----------------------------------------------------------------- |
| `@v1`     | Moving major. A release repoints it, so fixes arrive on next run. |
| `@v1.3.0` | Exact. Nothing changes under you; Renovate opens the bump PR.     |
| `@main`   | Don't. An unreviewed merge here reruns eleven repos' CI.          |

`@v1` is the default recommendation — the whole point of one tooling repo is
that a fix lands once. Pin exactly when a repo is somewhere you cannot afford a
surprise (a release path, a repo you rarely look at); the Renovate preset groups
those bumps with the `magic-*` npm packages into one PR and automerges it, so
pinning costs a merge button, not a migration.

The reusable workflows pin every `GSTJ/magic` composite action they call to a
full release commit SHA. GitHub checks the complete chain when a caller requires
immutable actions, so a workflow pinned by SHA is still rejected if one of its
steps calls an action through `@v1`. Action code ships first, and a reviewed
follow-up advances the workflow's SHA. Self CI exercises that remote pinned path
before the follow-up can merge.

Releases happen in [`self-release.yml`](.github/workflows/self-release.yml) on
every push to `main`: it runs the full check chain, publishes any package whose
version is not on npm yet, cuts `vX.Y.Z` from the conventional commits since the
last tag, and moves `v1`.

### Required checks

A called workflow always reports as `<caller job> / <called job>`, so it can
never produce a bare context name — a ruleset that requires `verify` will never
be satisfied by a reusable workflow alone. Two ways out:

- name both halves: a caller job `verify` plus `job-name: verify` reports
  `verify / verify`, and that is the string to put in the ruleset;
- or keep a one-line shim job that `needs` the call and checks its `result`,
  which is what two repos already do. Note that a _skipped_ required check
  counts as satisfied, so the shim needs `if: always()` and an explicit
  comparison against `success`.

### Sending the checks to your own runner

`ci.yml` runs on `ubuntu-latest` and should keep doing so in most repos — Ubuntu
minutes are the cheap ones, and a lint job is not what makes an Actions bill.
The case for moving it is the repo that already has a self-hosted Mac for
something else (iOS E2E, usually) and whose hosted minutes have run out or are
billed privately: then the choice is not "Mac or Ubuntu", it is "Mac or nothing".

Four inputs, the same four `e2e-ios.yml` takes, with the same meanings:

| Input                       | Default         | What it is                                                                    |
| --------------------------- | --------------- | ----------------------------------------------------------------------------- |
| `runner-labels`             | `ubuntu-latest` | Where the job goes. A bare label, or a JSON array of them.                    |
| `hosted-fallback-labels`    | `""`            | Where it goes instead when the Mac is not answering. Empty turns routing off. |
| `runner-heartbeat`          | `""`            | The Mac's liveness beacon, as a Unix timestamp.                               |
| `heartbeat-max-age-seconds` | `600`           | How old that timestamp may be before the run goes hosted.                     |

**Private repo with a Mac runner and a hosted fallback.** Paste this:

```yaml
jobs:
  ci:
    uses: GSTJ/magic/.github/workflows/ci.yml@v1
    with:
      runner-labels: '["self-hosted","macos-local"]'
      hosted-fallback-labels: '["ubuntu-latest"]'
      runner-heartbeat: ${{ vars.MAC_RUNNER_HEARTBEAT }}
```

`runner-heartbeat` has to be passed in, and it has to exist. A called workflow
cannot read the caller's variables for you, and the router cannot ask GitHub
whether the runner is up either: `gh api repos/{repo}/actions/runners` needs the
`administration` permission, which `GITHUB_TOKEN` cannot hold under any
`permissions:` block — 403, always. So the privileged half runs on the Mac. A
timer there confirms its own listener is up, confirms GitHub agrees the runner is
online, and writes `date -u +%s` into the repo variable `MAC_RUNNER_HEARTBEAT`,
which any workflow reads for free as `vars.MAC_RUNNER_HEARTBEAT`. Publish it
often enough that a healthy machine is never stale — 120s against a 600s window
is what the fleet runs. No token is ever stored in the consuming repo.

With no `MAC_RUNNER_HEARTBEAT` variable at all, `vars.MAC_RUNNER_HEARTBEAT` is
the empty string and every run goes to `hosted-fallback-labels`. That is the
intended failure direction, and it is also what an unadopted repo looks like.

**Nothing here can stop the checks from running.** `🧭 Route` is its own
`ubuntu-latest` job with `continue-on-error`, and the check job reads
`needs.route.outputs.labels || inputs.runner-labels`. If the router is killed on
arrival — which is exactly what happens on a repo whose Actions billing has
lapsed, the situation this exists for — its output is empty, the job falls back
to `runner-labels`, and it runs. It appears in the PR checks as a skipped context
when routing is off; a skipped conclusion is neutral, so it satisfies nothing and
blocks nothing. The gating context is still `<caller job> / <job-name>`, spelled
exactly as before.

`runs-on` still works and now defaults to empty rather than `ubuntu-latest`; it
overrides `runner-labels` as the base the router starts from. A repo that passes
neither gets `ubuntu-latest` on the same job with the same name, which is what it
got before this existed.

#### What the job does differently off a hosted runner

A self-hosted runner is persistent, shares one directory with every other
workflow in the repo, and is somebody's machine. Three things follow, and each
is a default you can override:

- **`checkout-clean: auto`** — `clean: false` off a hosted runner.
  `git clean -ffdx` here would delete the `node_modules` and `ios/` that the E2E
  workflow on the same machine keeps in order to build incrementally. A lint job
  has no use for a scrubbed tree anyway.
- **`pnpm-store-cache: auto`** — the pnpm store is round-tripped through the
  Actions cache service on a hosted runner and left alone anywhere else. On a
  machine that keeps its disk the store is already there, already shared with
  every other workflow on it, and `hardlink` (what `setup` picks off-hosted) is
  what makes installing from it nearly free. Restoring a copy over it buys a
  download and a repack.
- **`turbo-cache: true`, unconditionally.** This one is kept on deliberately:
  turbo reads its own local cache first and only reaches the Actions backend on
  a miss, so a warm machine never pays for it, and a workspace some other
  workflow cleaned still gets its outputs back rather than rebuilding them.

`~/.maestro`-style user-directory caches are the fourth of these and live in
[`e2e-ios.yml`](#ios-e2e) — `cache-maestro: auto`, off on a self-hosted Mac,
because on a machine somebody uses that is their install and their run history,
not CI's. `ci.yml` touches no user directory and needs no equivalent.

### Composite actions

The reusable workflow only fits jobs whose shape is "install, then run some
commands". Anything else — a macOS E2E build, a docs deploy, a matrix — should
call the composite actions directly instead of hand-rolling the same four steps
again.

```yaml
steps:
  - uses: actions/checkout@v7 # yours: an action cannot run before the checkout

  - uses: GSTJ/magic/.github/actions/setup@v1
    with:
      working-directory: apps/mobile # default: .
      node-version: "22" # default: read .nvmrc
      cache: "true" # default: pnpm store cache, keyed on the lockfile
      install-command: pnpm install --frozen-lockfile
      turbo-cache: auto # auto = on when there is a turbo.json
```

`registry-url` is empty by default and should stay that way outside publish
jobs. Setting it writes an `.npmrc` containing a literal `${NODE_AUTH_TOKEN}`,
and the package-manager probes behind `cache:` choke on that when no token is
exported — pass `registry-url` and `node-auth-token` together, or neither.

For iOS E2E, call [`e2e-ios.yml`](#ios-e2e) instead of assembling the steps
yourself. The three composites it is made of —
[`setup-ios-e2e`](.github/actions/setup-ios-e2e/action.yml),
[`build-ios-app`](.github/actions/build-ios-app/action.yml) and
[`run-maestro`](.github/actions/run-maestro/action.yml) — are usable on their
own when a repo needs a shape the workflow does not have:

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: GSTJ/magic/.github/actions/setup@v1
  - uses: GSTJ/magic/.github/actions/setup-ios-e2e@v1
    id: ios
    with:
      xcode-version: "26" # newest installed Xcode 26.x
      boot: "false" # start the boot, let the build overlap it
  - uses: GSTJ/magic/.github/actions/build-ios-app@v1
    id: build
    with:
      udid: ${{ steps.ios.outputs.udid }}
  - uses: GSTJ/magic/.github/actions/run-maestro@v1
    with:
      udid: ${{ steps.ios.outputs.udid }}
      app-path: ${{ steps.build.outputs.app-path }}
```

Not `expo run:ios`. It re-runs `pod install`, waits on a Metro that
`--no-bundler` never started, and finishes by opening
`<scheme>://expo-development-client/?url=http://<lan-ip>:8081` on the device —
which is where the intermittent `LSApplicationWorkspaceErrorDomain 115` comes
from. `build-ios-app` drives `xcodebuild` and `simctl` directly instead.

And on a bot-opened PR whose runs GitHub parks at `action_required`:

```yaml
- uses: GSTJ/magic/.github/actions/approve-parked-ci@v1
  with:
    pull-request: ${{ steps.pr.outputs.number }}
    token: ${{ secrets.GH_PAT }} # needs actions:write + pull-requests:write
```

<a id="ios-e2e"></a>

## iOS E2E

```yaml
# .github/workflows/e2e-ios.yml in the consuming repo
name: E2E iOS
on:
  pull_request:
    branches: [main]

jobs:
  e2e:
    uses: GSTJ/magic/.github/workflows/e2e-ios.yml@v1
    with:
      app-dir: apps/mobile
```

That is the whole adoption for a repo with an Expo app and a `.maestro`
directory next to it. It prebuilds, installs pods, builds for the simulator,
boots a device against the compile, installs the app, runs every flow with a
retry, and uploads the screenshots when something goes red.

The defaults are the ones that were measured, not the ones that read well. Two
repos went from 44m25 and 22m04 to 19m13 and 8m32 on hosted runners, and one to
6m41 on a Mac mini, on these settings:

| Default                                         | Why                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHS=$(uname -m)`, `ONLY_ACTIVE_ARCH=NO`      | Release defaults to `arm64 x86_64` for the simulator SDK. One repo compiled 840 of 850 translation units twice.                                            |
| Optimiser off _inside_ Release                  | `-configuration Debug` boots the dev launcher when expo-dev-client is installed. Release keeps NDEBUG and the JS bundle.                                   |
| `ios/` cached on native inputs only             | JS is excluded on purpose: the Xcode bundling phase is `alwaysOutOfDate`, so a JS change cannot go stale through the cache.                                |
| DerivedData on the **same** key as `ios/`       | A restored `ios/` against an empty DerivedData is the one combination slower than starting cold.                                                           |
| DerivedData strategy switches on runner kind    | `actions/cache` on a hosted runner, a fixed path with a key stamp on a self-hosted one — 1.2 GB is not worth uploading from a machine that keeps its disk. |
| `cache/restore` + `cache/save`, never `cache`   | Plain `actions/cache` only saves on whole-job success, so a red Maestro run leaves the next build cold.                                                    |
| Boot started before the build, waited for after | Measured: booting before `pnpm install` cost 220s on Setup Node; waiting after the build left the flows at 457s instead of 165s.                           |
| Bounded boot wait, then erase and retry once    | `simctl bootstatus -b` never returns on a wedged device. An unbounded step already cost one cancelled hour at 10x billing.                                 |
| Device picked from the runtime's own list       | Choosing the newest runtime and the newest iPhone independently pairs combinations `simctl create` rejects.                                                |
| `maestro --device <udid>`                       | Without it Maestro drives whichever simulator is booted. On a Mac mini that is the owner's, not yours.                                                     |
| No ccache                                       | CocoaPods wires it through `CC`/`CXX`, which Xcode 26 does not use to compile. An instrumented launcher logged zero calls.                                 |
| Workspace kept off a hosted runner              | `git clean -ffdx` deletes `node_modules` and `ios/`, and the reinstall makes RN's codegen re-emit 84 identical files with new mtimes. See below.           |
| One simulator, kept between runs                | Its UDID is in `-destination`, so it is in the build description. A new device per run invalidates the whole incremental build. See below.                 |
| pnpm hardlinks off a hosted runner              | A cloned `node_modules` is a new inode and a new mtime per file, and Xcode decides what is stale by timestamp. See below.                                  |

### What actually makes a warm DerivedData warm

Three things, and each one hides the next. Any one of them left alone makes the
other two worth nothing, which is why fixing them one at a time changed the
measured build time by zero seconds twice in a row.

**The workspace has to survive — in every workflow, not just this one.**
`actions/checkout` defaults to `clean: true`, which runs `git clean -ffdx` and
deletes every ignored file — `node_modules` and `ios/` included. And a runner
keeps **one** directory per repo, shared by every workflow in it, so a lint job
that cleans undoes this for the E2E job that runs after it. `ci.yml` takes the
same `checkout-clean` input and the same default for exactly that reason; a
repo with hand-written workflows on the same runner has to do the same, or the
build alternates between 27s and 90s depending on what ran before it (measured,
and the reason this paragraph exists). On a runner that keeps its disk that is
loss twice over. The run pays to restore `ios/` from a cache of a directory it
already had, and the reinstalled `node_modules` makes React Native's codegen
re-emit `ios/build/generated/**`: 84 files, byte-for-byte identical, every one
with a new mtime. Xcode reads mtimes, so `ReactCodegen` recompiles and so does
every pod whose headers come from it — `RNScreens`, `RNSVG`,
`RNGestureHandler`, `react-native-safe-area-context`. Left alone,
`pnpm install --frozen-lockfile` finishes in 194 ms with "Already up to date"
and moves nothing at all. So `checkout-clean` is `false` off a hosted runner,
and `ios/` is then reused straight from the workspace with a key stamp beside
it, rather than restored over itself — extracting the archive on top would put
the archive's mtimes back and undo exactly what this bought.

**The simulator has to be the same simulator.** `-destination` carries the
device UDID, the UDID is part of the build description, and changing it
invalidates every target. Measured on one Mac — same sources, same settings,
same warm 2.0 GB DerivedData, only the device differing:

| Build                  | Wall | Compile tasks |
| ---------------------- | ---- | ------------- |
| repeat, same UDID      | 24s  | 4             |
| repeat, different UDID | 69s  | 310           |

Creating a device per run, which is what this action used to do off a hosted
runner, therefore cancelled the DerivedData cache on every single run — the
cache was restored, reported as a hit, and then not used for anything. So
`reuse-device` defaults to keeping one device named `magic-e2e` between runs
off a hosted runner. It is erased before use, so it starts as clean as a fresh
one; what it keeps is its identity. On a hosted runner nothing survives the
job, so nothing changes there.

If you pin `simulator-device` to a name whose runtime the image later drops,
the device is recreated and that one run pays the full build. That is the same
trade as any cache key.

**The install has to hand back the same files.** `package-import-method`
defaults to `auto`, which is `hardlink` off a GitHub-hosted runner and pnpm's
own default on one.

pnpm's own `auto` clones — APFS copy-on-write — and a clone is a **new inode
with a new mtime** for every file it materialises. `actions/checkout` cleans
ignored files, so `node_modules` is reinstalled every run; with a clone, every
file in it comes back newer than the object files built from it. React Native's
pods compile out of `node_modules`, so that is a full recompile on its own.
Hardlinking reuses the store's inodes, mtimes included: the reinstalled tree is
byte-for-byte the same files, with the same timestamps, and nothing looks stale.

It is set in the environment for the install step only. Nothing writes an
`.npmrc`, so no developer's checkout changes and no later command inherits it.
Which variable does the work depends on the pnpm version, and the action sets
both because the fleet is on more than one:

| pnpm  | `npm_config_package_import_method` | `PNPM_CONFIG_PACKAGE_IMPORT_METHOD` |
| ----- | ---------------------------------- | ----------------------------------- |
| 9, 10 | ✅                                 | ❌                                  |
| 11    | ❌                                 | ✅                                  |

pnpm 11 stopped reading `npm_config_*` altogether — `npm_config_store_dir` does
not move the store either — which is worth knowing before you reach for that
prefix for anything else.

Hardlinking needs the store and the workspace on one volume. When they are not,
pnpm falls back on its own; nothing here has to detect it.

### Adoption, per repo shape

**Public repo, hosted runner.** macOS minutes are free on a public repo, so
there is nothing to tune:

```yaml
jobs:
  e2e:
    uses: GSTJ/magic/.github/workflows/e2e-ios.yml@v1
    with:
      app-dir: examples/kitchen-sink
      flows: |
        .maestro/smoke-launch.yaml
        .maestro/smoke-modal-open-close.yaml
```

**Private repo with a Mac runner and a hosted fallback.** macOS bills at 10x on
a private repo, so this one job can cost more than everything else in the
account. Route to the Mac when it is awake and to a hosted runner when it is
not. The routing signal is a beacon, not a live lookup:
`gh api repos/{repo}/actions/runners` needs the `administration` permission,
which `GITHUB_TOKEN` cannot hold under any `permissions:` block — it answers
403 and always will. A timer on the Mac confirms the runner is listening and
writes a timestamp into a repo variable, which any workflow can read for free.

```yaml
jobs:
  e2e:
    uses: GSTJ/magic/.github/workflows/e2e-ios.yml@v1
    with:
      runner-labels: '["self-hosted","macos-local"]'
      hosted-fallback-labels: '["macos-26"]'
      runner-heartbeat: ${{ vars.MAC_RUNNER_HEARTBEAT }}
```

`runner-heartbeat` has to be passed in: a called workflow cannot read the
caller's variables for you. On a self-hosted runner the workflow also keeps one
dedicated simulator between runs and erases it before each, rather than driving
whatever the machine's owner has booted or minting a new device every time; it keeps
DerivedData at a fixed path instead of round-tripping it through the cache
service; it hardlinks the pnpm install rather than cloning it; and it leaves
`~/.maestro` alone, because on a machine somebody uses that is their install
and their run history, not CI's.

**Routing is advice and cannot stop the suite.** The `🧭 Route` job runs on
`ubuntu-latest` with `continue-on-error`, and every job that consumes it reads
`needs.route.outputs.labels || inputs.runner-labels`. That matters more than it
sounds: a repo whose Actions billing has lapsed cannot start _any_ hosted job,
and in the round before this one routing was a step in a hard-gating preflight —
so the router failed on arrival, the macOS job refused to start, and the E2E
suite stopped running with nothing red to show for it. The only Ubuntu job that
can still stop a merge is the quarantine lint, which exists only when you set
`quarantine-file`, and which is meant to.

**Stateful suite, sharded and part-gated.** Flows that share a fixture cannot be
split by count, only by which rows they touch. Name the shards, and let the ones
you do not trust yet report without blocking:

```yaml
jobs:
  e2e:
    uses: GSTJ/magic/.github/workflows/e2e-ios.yml@v1
    with:
      app-dir: apps/mobile
      quarantine-file: .maestro/quarantined.txt
      shards: >-
        [
          {"name": "core",   "flows": "flows/01-launch.yaml,flows/02-login.yaml,flows/03-feed.yaml"},
          {"name": "fresh",  "flows": "flows/20-account-creation.yaml"},
          {"name": "delete", "flows": "flows/27-delete-account.yaml", "soft": true}
        ]
```

Every non-quarantined flow should appear in exactly one shard — nothing checks
that for you, so say it in a comment above the list and keep it true.

### When to shard, and when not

A second macOS job costs job setup, a checkout, the `.app` download and another
simulator boot: about 3 minutes, measured, billed at 10x on a private repo. Each
shard also pays Maestro's ~60s XCUITest driver start again. So sharding into `S`
shards is only faster when the flows themselves take longer than

    T > 240 × S / (S − 1) seconds

| Shards | Flows must exceed | Extra macOS minutes billed |
| ------ | ----------------- | -------------------------- |
| 2      | 8 min             | ~4                         |
| 3      | 6 min             | ~8                         |
| 4      | 5m20              | ~12                        |

The right column is the price, not the prize: sharding trades billed minutes for
wall-clock, and on a private repo each of those minutes costs ten.

Two repos measured their suites at 165s and 16s of actual flow execution and
both kept a single job — at those numbers a matrix makes the run slower _and_
more expensive. Time the flows before you shard: `maestro test` prints per-flow
durations, and the job summary this workflow writes lists them per run.

`shards: "3"` deals the flows round-robin, which assumes they are independent.
If flow 03 reads what flow 02 wrote, it is not a sharding problem yet — it is a
fixture problem, and naming the shards is the honest workaround.

### Flaky flows

Two halves, and only one of them is code here.

**Quarantine — shipped.** Point `quarantine-file` at a file of flow stems:

```
# <flow-stem>   # reason: <text>; owner: @handle; added: YYYY-MM-DD
27-delete-account   # reason: XCUITest driver dies mid-flow; owner: @GSTJ; added: 2026-07-20
```

A listed flow never runs and never fails the build, and its owner's handle is
rendered into the job summary on every run. The `🚧 Quarantine lint` job checks
the file before anything expensive starts: all three fields are required, and an entry
older than `quarantine-max-age-days` (30) turns the workflow red. That decay
rule is the whole point. A quarantine file without one is a list of tests that
quietly stopped mattering; with one it is a borrowing facility with a maturity
date, and past it nothing merges until somebody fixes the flow, deletes the
entry, or moves it to a soft-gated shard.

**Flake statistics — a recipe, not code.** The loop worth closing is: read the
JUnit reports from the last N runs, compute a pass rate per flow, and map it to
an action rather than a number.

| Pass rate over ≥5 runs | Verdict                      |
| ---------------------- | ---------------------------- |
| ≥ 95%                  | stable — promote to required |
| 80–95%                 | ok                           |
| 30–80%                 | flaky — investigate          |
| ≤ 30%                  | broken — quarantine or fix   |

This is deliberately not shipped as an action. It needs `gh run list` filtered
by _your_ workflow file name, `gh run download` matched against _your_ artifact
names, and an XML walk whose suite-to-flow mapping depends on whether you set
`per-flow`. Every one of those is a repo-specific string, and an action that
took five inputs to express them would be harder to read than the 90 lines of
Python it replaced. A working implementation to copy lives in `pegada`'s
`.github/scripts/maestro-flake-stats.py`.

**Set `upload-artifacts: always` before you try it.** The default is
`on-failure`, which is right for a repo that only wants evidence when something
broke — and useless for flake statistics, because a flaky flow passes some of
the time by definition. A history that keeps only the red runs makes every flow
in it look 0% and computes no pass rate at all:

```yaml
jobs:
  e2e:
    uses: GSTJ/magic/.github/workflows/e2e-ios.yml@v1
    with:
      app-dir: apps/mobile
      upload-artifacts: always # every run, so a pass rate has a denominator
```

With it on, every run uploads a JUnit report per shard, named after the shard,
under `<shard-name>-<run-attempt>`.

The same goes for `@expo/fingerprint` bundle-swap caching — around 260 lines of
repo-specific logic with a liveness-probe fallback. It stays in the repo that
needs it.

### Input surface

| Input                                                           | Default                         | For                                        |
| --------------------------------------------------------------- | ------------------------------- | ------------------------------------------ |
| `app-dir`                                                       | `.`                             | Where `app.json` / `app.config.*` lives    |
| `flows-dir` / `flows`                                           | `.maestro` / all of it          | What to run                                |
| `build-profile`                                                 | `release`                       | `release` or `dev-client` (Debug)          |
| `runner-labels` / `hosted-fallback-labels` / `runner-heartbeat` | `["macos-26"]`                  | The Mac-runner router                      |
| `shards` / `soft-gate-shards`                                   | `"0"` / `false`                 | Job topology                               |
| `quarantine-file` / `quarantine-max-age-days`                   | unset / `30`                    | Flake containment with an expiry           |
| `xcode-version` / `maestro-version`                             | `latest` / `2.7.0`              | Toolchain pins                             |
| `cache-maestro`                                                 | `auto`                          | Hosted only; see below                     |
| `simulator-device` / `simulator-runtime`                        | newest available                | Pin only if a flow needs a screen size     |
| `reuse-device` / `device-name`                                  | `auto` / `magic-e2e`            | One simulator kept between runs; see above |
| `checkout-clean`                                                | `auto`                          | Keep the workspace off a hosted runner     |
| `prebuild-command` / `install-command` / `node-version-file`    | Expo + pnpm defaults            | Bare RN, npm, a pinned Node                |
| `package-import-method`                                         | `auto`                          | Hardlink off a hosted runner; see above    |
| `native-cache-paths` / `cache-epoch` / `cold`                   | the list below / `v1` / `false` | Cache keying and cache busting             |
| `build-settings`                                                | unset                           | Extra `SETTING=value` xcodebuild arguments |
| `maestro-env` / `app-id` / `deep-link`                          | unset / `auto` / unset          | `-e` variables, and auth-token injection   |
| `retries` / `per-flow`                                          | `1` / `false`                   | Retry shape                                |
| `upload-artifacts`                                              | `on-failure`                    | `always` for flake stats, `never` to stop  |
| `env-file-contents`                                             | unset                           | Repos whose config reads a `.env`          |
| `timeout-minutes` / `flow-timeout-minutes`                      | `60` / `30`                     | Bounds                                     |

`deep-link` is the one worth knowing about: it opens a URL on the device after
install and before the flows. Mint a token in an earlier step, encode it into
your app's scheme, and no flow has to drive a WebView login — which removes the
single biggest source of mobile E2E flake and wall-clock, and the network
dependency on your identity provider along with it.

`app-id` is the one nobody should have to know about. The Expo templates write
their flows as `appId: ${APP_ID}`, Maestro leaves an undefined variable as that
literal string, and the failure reads as "app not installed" rather than as a
missing variable — so every repo hit it once and pasted its bundle id into
`maestro-env`, a second copy of a value the build already read out of the built
`Info.plist`. It is passed for you now. Set `app-id: off` if your flows name the
bundle themselves, or put `APP_ID=…` in `maestro-env` to win outright.

`cache-maestro` defaults to caching `~/.maestro` on a GitHub-hosted runner and
nowhere else. It is 332 MB — 3m51 to upload on a cold miss — and on a
self-hosted Mac that directory is the login user's own Maestro, with their test
history under it. A runner that keeps its disk does not need a cache of a thing
it already has, and restoring one over a working install to save a download it
never has to do is the worst of both.

### `native-cache-paths`, and what happens when it is short

The key that decides whether `ios/` and DerivedData are reused is a hash of
these tracked files, and nothing else:

```
pnpm-lock.yaml        package-lock.json     yarn.lock       .nvmrc
patches/**            Gemfile.lock          <app>/package.json
<app>/app.json        <app>/app.config.*    <app>/env.*     <app>/Gemfile.lock
<app>/plugins/**      <app>/assets/**       <app>/ios/Podfile
```

`<app>` expands to `app-dir`. Setting the input **replaces** this list, so add
to it rather than trimming it: a native input that is not on the list can change
without changing the key, and then the cache serves an `ios/` tree built from
something else. That is not hypothetical — `env.*` is on the list because the
obytes Expo template computes `BUNDLE_ID` and `NAME` in `env.js`, which decides
what lands in `Info.plist`, and a key that ignored it happily served the old
bundle id after somebody renamed the app. JS sources stay off the list on
purpose: Xcode's bundling phase is `alwaysOutOfDate` and regenerates the bundle
every build, so a JS change cannot go stale through this cache.

The list is printed in the build log on every run, and a run that matches no
tracked file at all says so with a warning and falls back to a date bucket.

## Renovate

```jsonc
// renovate.json in the consuming repo
{ "extends": ["github>GSTJ/magic"] }
```

That resolves to `default.json` at the root of this repo, which is where the
preset lives. Renovate deprecated serving a preset from `renovate.json`; this
repo's own `renovate.json` just extends the preset like everyone else's.

Third-party releases are quarantined for 14 days. A missing registry timestamp fails
closed, and Renovate keeps pending updates on the Dependency Dashboard instead
of opening early branches. Eligible updates are merged by Renovate only after
the repository's checks pass; majors and the hand-held tool groups below still
wait for review. `magic-*` packages and `GSTJ/magic` action tags are first-party
exceptions and may move immediately.

GitHub vulnerability alerts stay enabled and use the same 14-day quarantine.
Renovate's experimental OSV source is disabled because its false positives can
loop against versions that are already patched.

### What automerges

| Update                               | Automerges |
| ------------------------------------ | ---------- |
| minor, patch, pin, digest            | yes        |
| dev dependency, non-major            | yes        |
| grouped GitHub Actions, non-major    | yes        |
| **any major, anywhere**              | **no**     |
| `oxlint`, `oxfmt`, `oxlint-tsgolint` | no         |
| `fumadocs*`                          | no         |

Majors are denied by the final rule in `packageRules`, and it has to stay final.
Renovate evaluates every rule and the last one that sets a key wins, so a rule
appended after it takes majors back. `pnpm run validate-renovate` fails the
build when the gate moves, is narrowed, or disappears.

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

`magic-oxlint-plugin` ships eight rules. None is on by default anywhere — pick
the ones a given repo wants.

```sh
pnpm add -D magic-oxlint-plugin
```

```ts
// oxlint.config.mts — complete file, imports included
import { extendConfig } from "magic-oxlint-config";
import base from "magic-oxlint-config/base";

export default extendConfig(base, {
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
    // Tailwind / NativeWind repos only.
    "magic/no-manual-classname": "error",
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

**`oxlint --print-config` cannot be trusted on an `extends`-shaped config.** It
renders that shape post-expansion and pre-merge, so it prints `categories: {}`,
`env: { builtin: true }`, `globals: {}`, no `jsPlugins`, and every rule stripped
of its options — `"typescript/consistent-type-definitions": "deny"` where the
preset says `["deny", ["type"]]`, `unicorn/filename-case` with no `ignore` list,
`no-restricted-properties` with no message. All of those _are_ applied at lint
time. Seven repos ran this check during one upgrade round and concluded their
whole preset had been dropped; three started re-declaring rule options by hand.
The one field it reports accurately there is `ignorePatterns`, which really is
empty. Verify by linting a file, not by reading the printed config —
`fixtures/adversarial/extends` does exactly that on every `pnpm run check`.

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

**Naming an ignored path explicitly is an error, not a no-op.** oxfmt 0.60.0
exits **2** — `Expected at least one target file. All matched files may have
been excluded by ignore rules.` — when every path it was handed is excluded.
`oxfmt .` is unaffected. This bites release scripts: `magic-oxfmt-config` ignores
`**/CHANGELOG.md`, so a `version` script shaped like
`node tools/changelog.mjs && oxfmt CHANGELOG.md` now dies after rewriting the
changelog and before `git add`-ing it — during `npm version`, and only for
whoever cuts the next release. Drop the explicit `oxfmt CHANGELOG.md`, or, if
the changelog is hand-written and should be formatted, opt out:
`withoutIgnorePatterns(base, ["**/CHANGELOG.md"])` — see the
[oxfmt-config README](packages/oxfmt-config#formatting-a-file-the-shared-config-ignores).

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

**`--fix` output is not formatted, and `consistent-type-definitions` is where
you'll notice.** Its fixer emits a type alias with no terminating semicolon, so
a repo whose CI runs `lint:fix` and `format --check` as separate gates fails the
second one on code the first one just wrote. Valid TypeScript either way (ASI),
so typecheck and tests never notice. Always run the formatter after the fixer;
`lint:fix && format:fix` is the order.

**`typescript/consistent-type-definitions`' autofix does not survive an
`interface … extends`.** The rule is right and stays at `error` — the
`type` → `interface` direction is the dangerous one, see the Read-this note in
CHANGELOG.md — but on oxlint 1.75.0 its fixer has three failure modes on
`extends`, and it applies them without a word. Convert those by hand.

```ts
// 1. Empty body, two bases — the shadcn/cva component prop shape. `--fix`
//    produces a `{} &` intersection, which the same preset then reports as
//    typescript(ban-types). The fixer does not converge: it trades one error
//    for another, run after run.
interface Props extends React.ComponentPropsWithoutRef<"div">, VariantProps<typeof v> {}
// becomes: type Props = {} & React.ComponentPropsWithoutRef<"div"> & VariantProps<typeof v>

// 2. Inside a `declare module` augmentation, where the conversion is not just
//    unfixable but wrong: a type alias cannot merge with the upstream
//    interface, so the augmentation silently stops applying (or fails with a
//    duplicate identifier). Disable per site.
declare module "@tiptap/core" {
  interface Commands<ReturnType> { … }
}

// 3. Anything exported from a published package's public API. `interface` can
//    be declaration-merged by consumers; a `type` alias cannot. Assignability,
//    `extends` and `implements` are unaffected — only merging stops working,
//    and it stops working in someone else's repo.
```

`interface X extends Y` and `type X = { … } & Y` are also not the same type:
property resolution against a base carrying an index signature differs between
them. One consumer traced a prop widening to `any` through four files to this
conversion. It did not reproduce on a minimal case here, on either TypeScript
5.4.5 or tsgo 7.0.2 — but "the conversion is mechanical" is only true for an
interface with no `extends` clause, which is what `--fix` should be trusted with.

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

`pnpm run validate-observability` walks `magic-observability`'s built module
graph from each entry point and fails if one of them can reach an SDK it has no
business reaching — `posthog-js` from `/expo`, `posthog-node` from `/web`. That
split is the package's whole reason for having five entry points, nothing in
TypeScript enforces it, and it would otherwise break in a consumer's bundler
weeks later.

`pnpm run adversarial` runs `fixtures/adversarial` — end-to-end
expected-outcome checks against the real binaries: every emitted variant on a
clean file, the opt-in plugin rules, the README's restricted-imports snippet,
safe-jsx's autofix convergence, and oxfmt's import-sort edge cases.
