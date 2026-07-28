# Decisions log

Everything below was verified against the real binaries on 2026-07-26/27, not
recalled. Where a claim came from docs rather than a local run, it says so.

Versions: oxlint 1.75.0, oxfmt 0.60.0, oxlint-tsgolint 7.0.2001, pnpm 11.17.0,
turbo 2.10.7, TypeScript 7.0.2 (`latest` dist-tag), Node >= 22.

---

## 1. Research findings

### oxlint `extends` — path-based, not package-based

`.oxlintrc.json` has 12 top-level keys: `$schema`, `categories`, `env`,
`extends`, `globals`, `ignorePatterns`, `jsPlugins`, `options`, `overrides`,
`plugins`, `rules`, `settings`.

`extends` is `string[]`, resolved **relative to the config file's own
directory**. There is no node resolution. Verified:

```jsonc
{ "extends": ["fake-cfg/base.json"] }
// x invalid config file /…/scratchpad/extest/fake-cfg/base.json: NotFound
```

It joined the specifier onto the config dir. `"./node_modules/fake-cfg/base.json"`
works, including through a pnpm-style symlink, and a nested `extends` inside the
extended file resolves relative to _that_ file (so intra-package composition
works).

**`extends` drops `ignorePatterns`.** Verified on 1.75.0, both paths: a consumer
whose whole config is `defineConfig({ extends: [expo] })` gets none of the
preset's ignore patterns, and neither does `.oxlintrc.json` with
`"extends": ["./node_modules/magic-oxlint-config/expo.json"]`. With no
`.gitignore` present that run reported ~500k diagnostics out of `node_modules`;
with one, seeded files under `generated/`, `ios/` and `android/` were still
linted. Only patterns at the top level of the config oxlint loaded are applied,
so consumers must re-declare them: `ignorePatterns: expo.ignorePatterns` (JS) or
a literal copy (JSON). Same run, hoisted: one diagnostic. `.gitignore` is what
was masking this in real repos, and it does not cover the `ios/` and `android/`
that bare RN repos commit.

**Corrected 2026-07-27.** This said "Documented in both READMEs". It was
documented in one — `packages/oxlint-config/README.md`. The root README, which is
what the migration brief tells agents to follow verbatim, showed
`defineConfig({ extends: [base] })` with no `ignorePatterns` in Step 2 and in all
five copy-paste snippets, and said nothing about it in Gotchas. Seven of eleven
migrated repos shipped a config with zero ignore patterns;
`oxlint --print-config | jq .ignorePatterns` returned `[]` in every one.

Documenting it harder was not the fix. Two changes make the footgun unreachable
instead:

- **Step 2 no longer uses `extends`.** The recommended consumer config is
  `export { default } from "magic-oxlint-config/base";` — oxlint loads the preset
  as _the_ config, so there is no extending step to drop anything. This also
  makes it symmetric with the `oxfmt.config.mts` recipe one step below.
- **Local rules go through `extendConfig`,** which was already exported and
  already merges into one flat object. Verified: `extendConfig(base, {...})` as a
  default export keeps all 13 ignore patterns and applies the local rules.

The `extends` form is still documented, with the `ignorePatterns: base.ignorePatterns`
line beside it, because repos already on 1.0.0 have it. This repo's own
`oxlint.config.mts` now re-declares them too — it was the counter-example, and
consumers copy it as a template.

**Corrected again 2026-07-27 (§8).** Keeping the `extends` recipe documented was
wrong, and the claim above about what it drops was incomplete: `env` and
`globals` go with `ignorePatterns`. Both README recipes are gone, this repo's own
config is now `extendConfig`, and the presets defend `env`/`globals` themselves.
See §8.

`oxlint.config.ts` / `.mts` is the supported sharing path: `extends` there takes
**imported objects**, not strings. Verified end-to-end with a real npm package.
Requires the npm `oxlint` package (not the standalone binary) and Node >= 22.18.

**Decision:** ship both. `src/*.ts` builds to ESM entry points for the `.mts`
path (recommended), and `scripts/emit-json.mjs` generates `base.json` and
friends from the same source for JSON consumers. A test asserts the two never
drift.

### oxlint `jsPlugins` — works, and works better than expected

`ExternalPluginEntry` is a string, or `{ name, specifier }` where `specifier` is
a path **or a package name** (real node resolution, unlike `extends`). Rule
namespace = plugin name. Fifteen namespaces are reserved for the native Rust
plugins and need an alias if you want the JS version: `react`, `unicorn`,
`typescript`, `oxc`, `import`, `jsdoc`, `jest`, `vitest`, `jsx-a11y`, `nextjs`,
`react-perf`, `promise`, `node`, `vue`, `eslint`.

Compatibility tested locally against real packages:

| Plugin                                 | Result                                               |
| -------------------------------------- | ---------------------------------------------------- |
| `eslint-plugin-safe-jsx@1.3.0`         | **Works fully** — reporting, scope analysis, autofix |
| `eslint-plugin-react-native`           | Works (`no-inline-styles` fires)                     |
| `eslint-plugin-testing-library`        | Works (`prefer-screen-queries` fires)                |
| `eslint-plugin-react-compiler`         | Works, but unnecessary — see below                   |
| `@shopify/strict-component-boundaries` | Fails: `unable to load resolver "node"`              |

**safe-jsx needs no changes.** This was the main open risk. It's CJS,
`module.exports = plugin`, and its rule uses `sourceCode.getScope()` plus
`variable.references` / `scope.variables` — full scope analysis. All of it works
under oxlint, including `--fix` rewriting `bad && <span/>` to
`Boolean(bad) && <span/>`.

jsPlugins are marked alpha and explicitly outside semver, which is one reason
the README tells consumers to pin oxlint exactly.

**pnpm wrinkle:** jsPlugin specifiers resolve relative to the _consumer's_
config file, so a bare `"eslint-plugin-safe-jsx"` written inside a shared
package fails under pnpm's non-hoisted layout. The ESM entry points therefore
resolve to absolute paths via `createRequire(import.meta.url)` from inside
`magic-oxlint-config`, so the plugins are its dependencies and consumers install
nothing extra. The emitted JSON can't do that and uses bare specifiers, which is
documented.

### oxlint `--type-aware` — usable today, on any TypeScript version

**Corrected 2026-07-27.** This section previously read "gated on TypeScript 7"
and built design reasoning on it ("half the migration set is still on TypeScript
5.x and can't switch today"). That was wrong, and wrong in a way worth naming:
the requirement was inferred from the implementation rather than tested, and the
very phrase used to justify it — "built on typescript-go" — is the reason the
installed compiler does not matter. `oxlint-tsgolint@7.0.2001` embeds
typescript-go and never reads the repo's `typescript`. Verified firing
`typescript/no-unnecessary-type-assertion` with `typescript@6.0.3` installed.

The correction improves the design story rather than damaging it: type-aware
linting is available to the TypeScript 5.x half of the migration set **now**, one
devDependency and one flag, exactly as the dormant-rules decision below intended.

It also removed a trap. The old install line was
`pnpm add -D oxlint-tsgolint typescript@^7`, which pushes consumers onto a
compiler that breaks Next: `typescript@7.0.2` makes `next@15.5.19` fail to load
`next.config.ts` with `TypeError: Cannot read properties of undefined (reading
'fileExists')`, and converting that file to `.mjs` then makes Next silently stop
resolving tsconfig `paths`. The line is now `pnpm add -D oxlint-tsgolint`.

Needs the optional peer `oxlint-tsgolint` (a Go binary on typescript-go).
Enabled by `--type-aware` or `options.typeAware`. Type-aware rules are ordinary
`typescript/*` rules; there is no separate category. Coverage is 59 of 61
typescript-eslint type-aware rules — missing `naming-convention` and
`prefer-destructuring`.

**The finding that shaped the design:** a type-aware rule configured while the
flag is _off_ is ignored silently. No error, no warning. Verified — a config
with `typescript/no-floating-promises: "error"` ran clean without the flag and
reported the violation with it.

**Decision:** type-aware rules go in `base` unconditionally, dormant. Turning a
repo on is one flag plus two devDependencies, with no config change. This
matters because half the migration set is still on TypeScript 5.x and can't
switch today, but shouldn't need a config edit later.

Constraints for whoever enables it: no `baseUrl` in tsconfig, `pnpm -r build`
before linting in a monorepo (it reads dependency `.d.ts`), and don't leave
`"include": ["**/*"]` in a root tsconfig. Not TypeScript 7 — see above.

### oxfmt — has import sorting, has no config sharing

Config file: `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, or
`oxfmt.config.mts`. Nested lookup by default, nearest wins.

**No `extends`.** The key is not in the schema and is **silently ignored** if
written — no error, exit 0. Unknown keys generally fail open, so a typo'd option
does nothing quietly.

**Import sorting exists** as `sortImports`, off by default. It's a port of
`eslint-plugin-perfectionist`, so groups match by glob rather than regex, with a
`<modifier>-<selector>` group vocabulary and `customGroups` that outrank
predefined groups on a first-match-wins basis. The `@ianvs` `importOrder`
translates cleanly — see `packages/oxfmt-config/src/index.ts`.

The shipped schema's default `groups` and the published docs disagree about what
the default order is, and the binary follows the schema. So the default is not
something to rely on; we set `groups` explicitly.

**Decision:** `magic-oxfmt-config` is a real ESM package, consumed by a two-line
`oxfmt.config.mts`. Verified that oxfmt executes an `.mts` config importing an
npm package. (`oxfmt.config.ts` fails with "Cannot use import statement outside
a module" unless the package is `"type": "module"` — `.mts` always works, so
that's what the README uses.) A `magic-oxfmt-init` bin writes a snapshot
`.oxfmtrc.json` for anyone who can't run a TS config.

**`internalPattern` is prefixes, not globs.** Everything else in `sortImports`
is perfectionist-style glob matching (`customGroups[].elementNamePattern`
included), which makes `internalPattern` easy to get wrong. oxfmt's schema
documents it as "a prefix for identifying internal imports", default
`["~/", "@/", "#"]`, and matches with a plain starts-with. Globs there
(`"@/**"`) match nothing — silently, per the fail-open behaviour above — so
every aliased import falls through to `value-external` and sorts next to `zod`
instead of into its own internal group. Verified both ways against oxfmt
0.60.0. The config shipped with globs; corrected to prefixes on 2026-07-27, and
the adversarial fixture that recorded it as a KNOWN-BUG is now a plain
assertion. Restated explicitly in the config rather than left to the default, on
the same reasoning as `groups`: a default change would reshuffle imports across
every repo at once.

**One config file per directory, enforced.** oxfmt accepts exactly one of
`.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts` in a
given directory. Two present is not a precedence question — every run dies with
`Failed to load configuration file. Both '<a>' and '<b>' found in <dir>` and
exits 1. Verified for all four pairings with `.oxfmtrc.json`. Running
`magic-oxfmt-init` in a repo that had already done the README's
`oxfmt.config.mts` step therefore used to hard-break formatting with no warning.
The bin now refuses when an auto-loaded config already exists in the target
directory. `--force` deliberately does **not** override that: `--force` means
"overwrite the file I named", and creating a second config is a different
failure. `--out` to a non-config filename or another directory still works,
since oxfmt never auto-loads those.

### The consumer `oxfmt.config.mts` is a re-export, not an import + default

The README originally told every consumer to write
`import base from "magic-oxfmt-config"; export default base;`. That file fails
the lint preset shipped next to it —
`unicorn(prefer-export-from): Prefer re-exporting directly from the source module`
— so `pnpm run lint` exited 1 in every freshly migrated repo. This repo never hit
it because its own config spreads into a new object.

The README now says `export { default } from "magic-oxfmt-config";` (and
`export { next as default } from …` for the variants). Verified both ways: the
re-export form lints clean, and oxfmt executes it and applies the config —
a 94-character line reflows at `printWidth` 80 rather than staying on one line as
it does under oxfmt's own default of 100.

Fixed in the README rather than by switching `unicorn/prefer-export-from` off for
`*.config.mts` in the preset, because the rule is right and the two-liner was
just written the wrong way round.

**Update 2026-07-27:** the rule is now `"off"` everywhere — its fixer deletes
exports, see §2. The README still recommends the re-export form; it is simply
style advice again rather than something the linter enforces. Nothing else in
that reasoning changes, and in particular the _diagnostic_ was never the problem.

### Renovate preset lives in `default.json`, not `renovate.json`

`github>GSTJ/magic` resolves to `default.json`. Serving a preset out of
`renovate.json` is deprecated ("If you're using a renovate.json file to share
your presets, rename it to default.json") and would break every consumer's bot
config on whichever release drops it. The preset therefore moved to
`default.json` byte-for-byte, and `renovate.json` is now this repo's own config,
extending the preset via `local>GSTJ/magic` like any other consumer.

### Versions

- pnpm `latest` = 11.17.0. Root pins `packageManager: pnpm@11.17.0`.
- **Vercel-deployed repos pin pnpm 10.34.5 instead, and this is not optional.**
  Vercel supports pnpm 6–10 and selects the version from the lockfile's
  `lockfileVersion` (9.0 → pnpm 9 or 10); `packageManager` is consulted only when
  Corepack is on, which is an `ENABLE_EXPERIMENTAL_COREPACK` env var in the
  Vercel **project settings** — a repo cannot set it from its own files. So a
  repo pinned to pnpm 11 gets pnpm 9 on Vercel, run against the
  `pnpm-workspace.yaml` that pnpm 11 auto-created locally, and the deploy dies
  with `ERROR packages field missing or empty` while the GitHub integration
  starts reporting `"isMonorepo": true`. One repo hit this (only one deploys to
  Vercel) but it is unconditional for that class and undiagnosable from inside
  the repo — a platform silently running a different package manager than the one
  you pinned. pnpm 10 also still reads the `pnpm` key in `package.json`, so
  `overrides` and `onlyBuiltDependencies` stay where they are.
- TypeScript `latest` = **7.0.2** (not 6.x). The portfolio repo is already on it.
  Note the original reasoning here also cited "7.0 is the floor for type-aware
  linting" — that premise is gone (see above), so 7.x is the target on its own
  merits only, and `typescript@7.0.2` is known to break `next@15.5.19`. Repos on
  5.x or 6.x are not behind on anything that matters.
- turbo 2.10.7.
- oxlint 1.75.0 and oxfmt 0.60.0 pinned exactly, not caret-ranged.

---

## 2. Rule disposition

### Ported natively (no plugin needed)

| ESLint rule                                     | oxlint equivalent                                |
| ----------------------------------------------- | ------------------------------------------------ |
| `@typescript-eslint/*` type-aware family        | `typescript/*`, dormant until `--type-aware`     |
| `@typescript-eslint/no-unused-vars`             | `no-unused-vars` (TS-aware; also covers imports) |
| `unused-imports/no-unused-imports`              | `no-unused-vars`                                 |
| `prefer-arrow-functions/prefer-arrow-functions` | `func-style: ["error", "expression"]`            |
| `react-compiler/react-compiler`                 | `react/react-compiler` (native, nursery)         |
| `react-hooks/rules-of-hooks`, `exhaustive-deps` | `react/rules-of-hooks`, `react/exhaustive-deps`  |
| `@next/next/*`                                  | `nextjs/*` (native — no plugin dependency)       |
| `@shopify/no-namespace-imports`                 | `import/no-namespace` (see below)                |
| jest, jsx-a11y, react, import, promise, unicorn | native namespaces                                |

`import/no-namespace` was listed here from the start but shipped as `"off"` in
`base`, so the ported rule caught nothing — `import * as utils from "./x"` ran
clean. Now `"error"` in `base`; `react` and below re-declare it as
`["error", { ignore: ["react", "@radix-ui/*"] }]`, which is the old
`@shopify/no-namespace-imports` allow list (`ignore` globs match the module
specifier — verified: `react` and `@radix-ui/react-dialog` pass, `node:path` and
`./x` are reported). Off in the test override, since
`import * as api from "./api"` is how `jest.spyOn(api, …)` works.

**The mechanism, stated correctly.** Two places in this document used to describe
this as "an `overrides[]` entry that omits `plugins` re-activates category rules
for the files it matches". That is what it looks like from inside the presets,
and it is not what oxlint does. Verified on 1.75.0 against a consumer config:

| consumer writes                                            | `jest/valid-title` |
| ---------------------------------------------------------- | ------------------ |
| nothing                                                    | fires              |
| top-level `rules: { "jest/valid-title": "off" }`           | **still fires**    |
| override entry, `rules` only, no `plugins`                 | **still fires**    |
| override entry, `plugins: [...base list, "jest"]`, `rules` | silent             |

The rule is: **a rule belonging to a plugin that is not enabled for a given
override entry's own plugin set is ignored there, silently.** `jest` is enabled
only inside `base`'s test-file override, so no other entry — the consumer's
included — can configure a `jest/*` rule. The top-level row fails for the
adjacent, ordinary reason that an override beats a top-level rule on files it
matches.

Consequence: every rule the preset sets inside an override is effectively
unconfigurable downstream unless the consumer repeats the plugin list. Two repos
lost time to this; one renamed a `describe` block rather than turn a rule off.
`testFilePlugins` is now exported from `magic-oxlint-config` so the workaround is
an import instead of an incantation, the root README's Gotchas carries the exact
before/after, and `fixtures/adversarial/override` executes both directions on
every run.

The presets' _other_ override entries were audited at the same time. They do not
have this problem: everything they configure (`import/*`, `unicorn/*`,
`react/*`, core rules) comes from a plugin that is in the top-level list, and
adding the offs that M7 and M17 needed to the `next` App Router entry worked
without touching its `plugins` — verified before shipping, not assumed.

**`jest.configs["flat/recommended"]` is enumerated by hand, not inherited from a
category.** The old base applied the whole recommended set. `categories` do not
activate rules for a plugin that is only declared inside an `overrides[]` entry,
which is the only place `base` declares `jest` — so for a while only the seven
rules named explicitly were live and `no-standalone-expect`,
`no-conditional-expect`, `valid-describe-callback`, `no-export`,
`no-done-callback`, `no-alias-methods` and the rest were silently off. Worse,
they _were_ on in `react` and below, because the react preset appends a second
test-file override with no `plugins` key and that flips the category behaviour
back on. Adding `plugins` to that override does not undo it, so the whole
recommended set is now spelled out in `base`, along with explicit `"off"` for the
category-only extras that differed between variants
(`prefer-called-with`, `prefer-ending-with-an-expect`,
`prefer-importing-jest-globals`, `padding-around-*`). All five variants now
report the identical jest rule set on the same fixture; `test/variants.test.mjs`
asserts it.

**`typescript/no-misused-promises` keeps `checksVoidReturn.attributes: false`.**
The incumbent config set it so `onClick={async () => …}` is allowed, and dropping
it would have been invisible until the first repo turned on `--type-aware` —
which defeats the point of shipping the type-aware rules dormant. Verified with
`oxlint --type-aware` + `oxlint-tsgolint` against a typed React fixture: with the
default options both the JSX handler and `const cb: () => void = async () => …`
are reported; with the preset only the second is. tsgolint accepts the
typescript-eslint option shape verbatim.

### Replaced with a different mechanism

**`no-restricted-syntax` does not exist in oxlint.** It was used for three
things, and all three map to real rules now:

- The `process.env` ban →
  `no-restricted-properties: [{ object: "process", property: "env", message }]`.
  Verified firing.
- The React Native Touchable/Image import bans → `no-restricted-imports`. The
  ESLint config used AST selectors _specifically_ because
  `no-restricted-imports` couldn't give per-`importName` messages for the same
  package. oxlint's version **can**: multiple `paths` entries with the same
  `name` each keep their own message. Verified with three overlapping entries
  against `react-native`. The workaround is no longer needed.

  Those bans are _not_ in the shared preset — they reference a per-repo
  `@/components/PressableArea`, so they're project config. The README shows the
  snippet for repos that want them.

- The statement bans (`ForInStatement`, `LabeledStatement`, `WithStatement`,
  applied to every file including `env.*`) → `guard-for-in`, `no-labels` and
  `no-with`, all at error. Labels and `with` keep exactly the old coverage
  (verified firing; `with` is additionally dead in strict-mode TS). `for..in`
  is a **deliberate relaxation**: the old config rejected it outright,
  `guard-for-in` accepts a loop wrapped in a `hasOwnProperty` check. A guarded
  `for..in` is the textbook-correct form, and `no-restricted-syntax` was the
  only way ESLint could ban it wholesale — accepting the guarded form is
  taking the real rule's judgement over the workaround's bluntness.

- `import/order` has no oxlint equivalent. **oxfmt owns import order** via
  `sortImports`, which also removes the ESLint/Prettier fight over it.

- `import/consistent-type-specifier-style: prefer-top-level` and
  `@typescript-eslint/consistent-type-imports` with
  `fixStyle: "inline-type-imports"` were **both** set in the incumbent config and
  directly contradict each other (`import type { Foo }` vs
  `import { type Foo }`). Resolved in favour of `typescript/consistent-type-imports`
  (top-level), with `import/consistent-type-specifier-style` off — matching the
  MM and invest-radar configs, and matching what oxfmt's `type` sort group
  expects.

### Ported as opt-in plugin rules (`magic-oxlint-plugin`, off by default)

| Rule                                 | Origin                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `magic/prefer-early-return`          | `@shopify/prefer-early-return`, `maximumStatements` option                |
| `magic/no-ancestor-directory-import` | `@shopify/no-ancestor-directory-import`, reimplemented without a resolver |
| `magic/react-require-autocomplete`   | `@shopify/react-require-autocomplete`, `inputComponents` option           |
| `magic/react-hooks-strict-return`    | `@shopify/react-hooks-strict-return`, `maximumReturnValues` option        |
| `magic/no-barrel-file`               | invest-radar's `scripts/no-barrel.sh`, now a real rule                    |
| `magic/no-module-mocks`              | g2i `testing-policy/no-module-mocks`, generalised to jest + vitest        |
| `magic/prefer-suspense-query`        | g2i `prefer-suspense-query/no-use-query`, roots configurable              |

Per the governing directive, none of these is in any default preset. Some are
stack-specific; the rest are policies a repo should choose.

The bottom three rows date from the first pass. The top four are the outcome of
governing directive #6 and are dispositioned rule by rule in §6 — three of them
were listed as _dropped_ in the table below until 2026-07-27.

**Rule API (revised).** These rules originally probed `require("oxlint").defineRule`
and used `createOnce` only if it turned up. It never turned up: oxlint 1.75.0's
main entry exports `defineConfig` and nothing else (`oxlint/plugins-dev` exports
only `RuleTester`), so the fast path was dead code and every rule ran ESLint's
per-file `create()` even under oxlint. `src/rule-api.ts` now emits `{ meta,
create, createOnce }` unconditionally, per `CreateOnceRule` in
`oxlint/dist/plugins-dev.d.ts`: "if `createOnce` method is present, `create` is
ignored". oxlint takes `createOnce`, ESLint takes `create`, nothing sniffs the
environment — a module-resolvability probe would only prove oxlint is installed,
not that it is the linter currently running. Consequence for rule authors:
`context.options` is per-file ("rule options for this rule on this file"), so it
must be read in `before()` alongside the filename. `prefer-early-return` was
reading it in the `createOnce` closure and is fixed; a two-file `overrides` test
now covers it.

### Dropped

| Rule                                                       | Why                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@shopify/jsx-no-hardcoded-content`                        | **Superseded by §6** — native `react/jsx-no-literals`, configured, off in the preset because it needs an i18n layer to be worth anything                                                             |
| `@shopify/strict-component-boundaries`                     | **Still dropped, see §6** — fails under oxlint (`unable to load resolver "node"`), and `no-restricted-imports` `patterns` covers it                                                                  |
| `@shopify/react-require-autocomplete`                      | **Superseded by §6** — ported as `magic/react-require-autocomplete`                                                                                                                                  |
| `@shopify/react-hooks-strict-return`                       | **Superseded by §6** — ported as `magic/react-hooks-strict-return`                                                                                                                                   |
| `@shopify/no-ancestor-directory-import`                    | **Superseded by §6** — ported as `magic/no-ancestor-directory-import`. "Expressible with `no-restricted-imports` patterns" was wrong; it needs an unbounded ladder of globs                          |
| `@shopify/restrict-full-import`                            | **Superseded by §6** — native `no-restricted-imports` with `importNames: ["default"]`, per-repo config                                                                                               |
| `react/jsx-no-leaked-render`                               | `safe-jsx/jsx-explicit-boolean` covers the `&&` case, which is the leak that matters. **Removed from oxlint before 1.75** — it's in the MM config and no longer loads.                               |
| `testing-library/*`                                        | Works as a jsPlugin unmodified, but shipping the dependency to every consumer isn't worth it. Add per repo.                                                                                          |
| `jest-formatting/*`                                        | Pure formatting; oxfmt handles spacing. oxlint's own `jest/padding-around-*` are off for the same reason                                                                                             |
| `reanimated/js-function-in-worklet`                        | Needs typescript-eslint parser services; a silent no-op under oxlint. See below                                                                                                                      |
| `eslint-plugin-eslint-comments`                            | Superseded by `--report-unused-disable-directives`. That's a CLI flag, not a config key, so it can't ship inside the preset — it lives in the README's recommended `lint` script and this repo's own |
| `unicorn/no-array-push-push`, `no-octal-escape`            | Both in the MM config, both gone from oxlint 1.75                                                                                                                                                    |
| `react/no-deprecated`                                      | Gone from oxlint 1.75. No syntax-only equivalent; `typescript/no-deprecated` covers part of it under `--type-aware` but is deliberately off (dependency deprecation metadata is unreliable)          |
| `react/no-unused-state`, `react/prefer-stateless-function` | Gone from oxlint 1.75. Class-component era rules; nothing in the migration set uses class components                                                                                                 |
| `unicorn/filename-case`                                    | See below — the repos disagree                                                                                                                                                                       |

`reanimated/js-function-in-worklet` was `error` in the old react-native config
and is the one old rule with no replacement. `eslint-plugin-reanimated@2.0.1`
(latest) loads fine as a jsPlugin — oxlint resolves its rule names, and a bogus
`reanimated/does-not-exist` fails the config as expected — but the rule's
`create()` starts with
`if (!context.parserServices?.hasFullTypeInformation) return {}` and then goes
through `parserServices.program.getTypeChecker()` and `esTreeNodeToTSNodeMap` to
resolve call signatures. oxlint's JS plugin API exposes no parser services and
no TS program, so the rule installs and reports nothing. Verified: a worklet
calling a plain JS function produced zero diagnostics with the plugin wired in.

Shipping it anyway would be worse than leaving it out, because the config would
claim a guarantee it doesn't provide. Nothing replaces it: the safety net is the
Reanimated Babel plugin plus the runtime "tried to synchronously call a
non-worklet function on the UI thread" crash. A repo that wants the lint back
has to keep ESLint alive for that one rule; revisit if oxlint ever exposes type
information to JS plugins, or if `js-function-in-worklet` gets a syntax-only
implementation.

`unicorn/filename-case` deserves its own note because it is on by default once
`style` is at `error`, and it defaults to kebab-case. Counted `.tsx` filenames
across the migration set:

| repo                      | PascalCase | kebab-case |
| ------------------------- | ---------- | ---------- |
| react-native-magic-modal  | 9          | 0          |
| gabriel-taveira-portfolio | 19         | 1          |
| pegada                    | 24         | 11         |
| invest-radar              | 0          | 64         |

Three of four are PascalCase-dominant. Leaving the rule on would have renamed
hundreds of files during a migration that is already changing everything else,
and it's a convention the repos have not agreed on. Off in the preset; a repo
that wants one convention enables it locally with its own `case` option.

### Preset scope

Following the governing directives: the presets carry general guidelines only,
deduped across the invest-radar / MM / pegada / magic-eslint-config lineage.
Project-specific config (PressableArea import bans, nws service boundaries,
prisma `ctx.db` conventions) stays out and is layered locally. MM and g2i were
read as references and are not migration targets.

One exception, deliberately: `new-cap` in the `react-native` variant carries
`capIsNewExceptions` for the react-native-gesture-handler `Gesture.*` factory
API (copied from MM). RNGH is stack-general for the GSTJ RN repos — the
exception list is shaped by the library's API, not by any one repo's
conventions, so making every RN consumer rediscover it locally would just be
copy-paste debt.

### Deliberate deltas vs the incumbent configs

The category sweep (`style`/`pedantic` at error) plus explicit settings reverse
a handful of the old config's choices. All were reviewed; none is an accident.

**Tightenings** (stricter than the old base — these fail loudly on first
contact, which is the acceptable direction):

- `import/no-anonymous-default-export`, `import/no-mutable-exports` and
  `typescript/array-type` were explicitly `off` in the old base and now error
  via the categories. Kept: all three are good general rules, and the config
  files where anonymous default exports are idiomatic get an override exemption
  instead.
- Core `require-await` errors via `pedantic` (the old config only carried the
  TS variant, off). Kept, including as the coverage story for the
  non-type-aware majority — but it's now off in the test override, where async
  test callbacks without `await` are routine. Note for whoever flips
  `--type-aware`: `typescript/require-await` (error, dormant) then runs
  alongside the core rule on the same code. invest-radar resolved that by
  turning the core rule off; do that per-repo when it actually happens, because
  doing it in the preset today would lose the rule everywhere else.
- `typescript/consistent-type-definitions` is `["error", "type"]`, not the rule's
  default `"interface"`. Direction matters here and the default is unsafe as an
  autofix: an interface has no implicit index signature, so
  `type LngProps = { lng: Locale }` becoming `interface LngProps` stops
  satisfying `Record<string, unknown>` and Next's `Params` constraint — and the
  errors appear at every _use_ site, not at the converted declaration. One repo's
  `--fix` did 98 of those conversions and broke every App Router page. The
  interface → type direction is safe (a type alias satisfies everything an
  interface does, plus index signatures) and it matches the type-alias-first
  style the rest of the preset leans toward. This repo converted its own ~25
  interfaces when the option flipped, which is the dogfood.
- `jest/valid-title`'s `mustNotMatch` is
  `(^should\b|^it\b|correctly|\.$)`. Without the word boundaries it banned
  titles starting with those _letters_, so `describe("itemsToChunks")` and
  `describe("shouldRetry")` were both reported — and describe blocks are normally
  named after the function under test. `it("should return null")` still fails.
- Rules the incumbents shipped at `warn` are uniformly `error` here — there is
  no warn tier in these presets, a rule is either worth failing CI or it's off.
  Affects `react/exhaustive-deps`, `react/no-children-prop`,
  `react-native/no-inline-styles`, `typescript/consistent-type-imports`.
- `max-depth` is `["error", 3]` — stricter than invest-radar (off) and MM
  (default 4 via pedantic). Three levels of nesting plus the
  `prefer-early-return` philosophy is the house style this repo family is
  converging on; expect first-run churn on migration repos.
- The `process.env` ban now also applies in test files, restoring the old
  `no-restricted-syntax` behaviour (the ban moved into
  `no-restricted-properties`, and the test override's `jest.clearAllMocks`
  entry was silently _replacing_ it — per-rule config replaces, it never
  merges). The same entry list bans `vi.clearAllMocks`, since invest-radar runs
  vitest and a jest-only ban would miss the closest migration target.

**Loosenings** (weaker than the old base — each one is a considered trade):

- `typescript/no-unsafe-call` is off, joining `no-unsafe-assignment` and
  `no-unsafe-member-access` (which the old config already disabled). The old
  config had it at error; it fires on the same untyped-boundary code as the
  other two, and keeping one third of the family produced noise without
  changing behaviour. `no-unsafe-argument` and `no-unsafe-return` stay at
  error — those are the two that catch `any` actually escaping.
- `typescript/no-base-to-string`, `typescript/no-confusing-void-expression`
  and `typescript/no-meaningless-void-operator` were error via strictTypeChecked
  and are off: `no-confusing-void-expression` fights the arrow-heavy house
  style (`=> setState(x)`), and the other two overwhelmingly fire on that same
  shape. Dormant either way until `--type-aware`.
- `typescript/no-unnecessary-type-parameters` is off although both references
  run it at error — it consistently misfires on generic helper signatures
  (`const pick = <T, K extends keyof T>(…)`), which shared-utility packages are
  full of.
- `unicorn/no-array-sort` **and `unicorn/no-array-reverse`** are off, the one g2i
  safety bullet not carried: invest-radar and pegada also disable `no-array-sort`,
  and on pre-`toSorted()` targets the autofix churn outweighs the mutation-safety
  win. `no-array-reverse` was left on at 1.0.0, which was an inconsistency rather
  than a decision — same rule family, same ES2023 method family, same targets.
  Its autofix rewrote `[...arr].reverse()` to `arr.toReversed()`, and
  `magic-tsconfig/base.json` pins `lib: ["ES2022"]`, so the shipped preset was
  autofixing code into a state the shipped tsconfig rejects. Hermes has the same
  gap at runtime. Raising `lib` to ES2023 was considered and rejected: it changes
  the compile target of every repo to accommodate one autofix, and does nothing
  for Hermes.

- `unicorn/prefer-export-from` is off. **Its fixer deletes code.** Verified on
  oxlint 1.75.0 — a module that re-exports imported names in two `export { … }`
  statements with an unrelated `export const` between them is rewritten under
  `--fix-suggestions` to a single `export … from`, and everything in between is
  gone. No diagnostic, no type error at the fix site. In the repo that reported
  it, a scheduled command string became
  `timeout --signal=TERM --kill-after=30s undefineds pnpm …`, caught only because
  two tests asserted on it; in the same run another file went from 39 exported
  names to 3.

  `["error", { checkUsedVariables: false }]` was tried first and is genuinely
  better than nothing — it makes the reported shape silent, because the derived
  export _uses_ one of the imported bindings. It is not enough: a barrel whose
  re-exported names are used nowhere else still collapses, taking any unrelated
  statement between the first and last re-export with it. Verified both.

  The fixer is a _suggestion_, so plain `--fix` never triggers it. That is not a
  reason to keep the rule: the README instructs every migrating repo to run
  `--fix` and read the result, two repos reached for `--fix-suggestions` on their
  own, and silent deletion of exported values is the worst failure on the list.
  Revisit when oxc fixes it; `fixtures/adversarial/base/src/derived-reexport.ts`
  is the shape to re-test with.

- `unicorn/catch-error-name` carries `{ ignore: ["^cause$"] }`. The rule is a
  naming convention and the convention is fine; the fixer rewrites the shorthand
  property **key** along with the binding, so
  `.catch((cause) => { throw new E(m, { cause }) })` became `{ error }` — an
  option `Error` does not know — and the error chain was lost with nothing to
  report it. That is a semantic change wearing a rename's clothes, and `{ cause }`
  is the standard idiom in exactly the code paths where error reporting matters
  most. The rule's second reported failure (renaming into an existing binding,
  TS2451) is loud and left alone.
- `for..in` degraded from a wholesale ban to `guard-for-in` — see
  "Replaced with a different mechanism" above.

---

## 3. Guard rails built

Two scripts exist because of things that went wrong while building this.

**`scripts/validate-rules.mjs`** — checks every rule name in every emitted
variant against oxlint's own shipped JSON schema. An unknown rule name is a
_fatal_ config error in oxlint, not a warning, so one stale name breaks every
consumer at once. Six rules in the MM reference config are already gone in 1.75
(verified against the shipped `configuration_schema.json`):
`react/jsx-no-leaked-render`, `unicorn/no-array-push-push`, `no-octal-escape`,
`react/no-deprecated`, `react/no-unused-state` and
`react/prefer-stateless-function`. All six have dispositions in the "Dropped"
table above. Run this after any oxlint bump.

**`scripts/smoke.mjs`** — lints `fixtures/smoke`, a deliberately broken file, and
asserts on exactly which rules fire. Guards against a config change quietly
ceasing to catch leaked `&&` JSX, `process.env` access, nested ternaries, unused
imports, and the two enabled plugin rules.

**`.github/workflows/self-ci.yml`** — neither guard script was actually wired to
anything. `ci.yml` and `release.yml` are both `workflow_call`-only, so nothing in
this repo ran on push or PR, while the Renovate preset automerges devDependency
and `magic-*` bumps "once CI is green" — with no checks, that means on sight. The
self-CI workflow calls `ci.yml` (rather than duplicating its steps) with
`build-command`, `test-command`, and `extra-command:
pnpm run validate-rules && pnpm run smoke`, so breaking the reusable workflow for
consumers breaks this repo's own build first.

---

## 4. Known gaps and TODOs

- **`react/react-compiler` is a `nursery` rule.** It's the one nursery rule the
  `react` preset enables, to preserve the incumbent
  `react-compiler/react-compiler`. Nursery rules are explicitly unstable; if it
  misbehaves on a repo, turn it off locally rather than fighting it.

- **`.oxfmtrc.json` snapshots go stale.** `magic-oxfmt-init` writes a point-in-time
  copy. Repos on that path won't pick up config changes from a version bump.
  Prefer `oxfmt.config.mts`. A `--check` mode that diffs an existing snapshot
  against the current package would close this; not built. The bin refuses to
  write next to an existing `oxfmt.config.{ts,mts}` or `.oxfmtrc.jsonc` (see
  §1), so the two paths can't be mixed by accident — but nothing detects a repo
  that switched from snapshot to `.mts` and left a stale `.oxfmtrc.json`
  behind. That state fails loudly on the next oxfmt run, at least.

- **No type-aware CI run anywhere yet.** The rules are configured and verified
  firing locally, but no repo in the migration set is switched on. invest-radar
  is closest (already runs `--type-aware` with its own config). The TypeScript 7
  floor that used to be given as the reason nobody can turn it on does not exist
  (§1) — this is now purely "nobody has".

- **The presets declare `jest`, not `vitest`, and one migration target runs
  vitest.** §2 already notes that the `process.env` ban lists `vi.clearAllMocks`
  "since invest-radar runs vitest and a jest-only ban would miss the closest
  migration target". The awareness is there; the plugin selection does not follow
  it. Concretely: `jest/no-untyped-mock-factory --fix-suggestions` writes
  `vi.mock<typeof import("x")>("x", factory)`, which is jest's
  `mock<T>(path: string, factory)` signature. vitest 4.1.9 declares
  `mock(path: string, factory?)` and `mock<T>(module: Promise<T>, factory?)`, so
  an explicit type argument rules out the string overload — all 25 fixes it
  applied were type errors. Documented in the README for now (swap the plugin in
  a local override); a `vitest` variant is the real fix and is not built.

- **`magic-oxlint-config` reinstalls the ESLint tree in every consumer.** Its two
  bundled JS plugins, `eslint-plugin-safe-jsx` and `eslint-plugin-react-native`,
  each declare a **required** (non-optional) `eslint` peer, and pnpm's default
  `autoInstallPeers: true` resolves it: `pnpm add -D magic-oxlint-config` into a
  repo with zero eslint dependencies pulls eslint 9, ~16
  `eslint`/`@eslint`/`@typescript-eslint` directories, 3.8 MB for eslint alone.
  Nothing executes any of it.

  This is the same objection §6 used to reject `@shopify/eslint-plugin` ("262
  packages, 97 MB") — smaller, and self-inflicted rather than avoided. Half of it
  is fixable at the source: `eslint-plugin-safe-jsx` is a GSTJ package and
  publishing 1.3.1 with `peerDependenciesMeta: { eslint: { optional: true } }`
  would halve the tree, and §1 already verified the plugin works fully under
  oxlint's jsPlugin host with no eslint present. That is a change in another
  repository and a publish, so it is not done here. `eslint-plugin-react-native`
  is upstream; vendoring the two rules actually used into `magic-oxlint-plugin`
  would end it permanently and is the better long-term answer.

  This repo now applies the source fix locally, via `packageExtensions` in
  `pnpm-workspace.yaml`, marking the `eslint` peer optional on both plugins.
  Install drops from 187 resolved packages to 101 and the eslint tree leaves the
  lockfile entirely; `pnpm run check` is unchanged at 83/83, including the two
  expectations that assert `safe-jsx(jsx-explicit-boolean)` and the
  `eslint-plugin-react-native` jsPlugin still load and fire. The README hands
  consumers the same stanza. It is still worth publishing safe-jsx 1.3.2 and
  vendoring the two react-native rules into `magic-oxlint-plugin`, because a
  `packageExtensions` entry is per-repo and every consumer has to add it.

  What forced the issue: Dependabot GHSA-mh99-v99m-4gvg (CVE-2026-14257,
  unbounded expansion length in `brace-expansion`, CVSS 7.5). The only vulnerable
  copy in this lockfile was `brace-expansion@1.1.16` under `minimatch@3.1.5`,
  reached exclusively through auto-installed eslint 9 — so it rooted in
  `magic-oxlint-config`'s real `dependencies`, which is why Dependabot scored it
  `runtime` rather than dev-only. There is no upgrade: 1.1.16 is the tip of the v1
  line and fixes a different bug (stack exhaustion in the `{a},b}` rewrite), the
  backports landed on 2.1.3, 3.0.3/3.0.4/3.0.5 and 5.0.8, and `minimatch@3.1.5`
  pins `^1.1.7`. Overriding across the major is not available either: 3.x and 5.x
  export a namespace rather than the function, so `minimatch@3`'s
  `var expand = require('brace-expansion'); expand(pattern)` dies with
  `TypeError: expand is not a function`. Verified all four locally against
  `minimatch@3.1.5`: 1.1.16 matches correctly but kills the process on
  `'{a,b}'.repeat(1500)` with `FATAL ERROR: JavaScript heap out of memory` under a
  256 MB heap, which is a `SIGABRT`, so the shell sees **exit 134** and not a
  catchable throw; 2.1.3 matches correctly and survives the same input in under
  200 ms; 3.0.5 and 5.0.8 `require()` fine but throw the `TypeError` the moment
  minimatch calls `expand`, which is `Minimatch.braceExpand` reached from the
  `Minimatch` constructor. Removing eslint removes the copy, which is the honest
  close.

  Also corrected: the README used to recommend
  `peerDependencyRules.ignoreMissing: ["eslint"]` for this. It does not work. On
  pnpm 11.17.0 it only suppresses the missing-peer warning; `autoInstallPeers`
  still installs eslint, and a minimal repro (one dependency on
  `eslint-plugin-react-native@5.0.0`) produces a byte-identical lockfile with the
  stanza and without it.

  The first paragraph also no longer claims "ESLint and Prettier are gone" — they
  do not run, which is a different and true statement.

  **Which of the two plugins carries the advisory, measured.**
  `eslint-plugin-react-native@5.0.0` caps its `eslint` peer at `^9`, and eslint 9
  is the last major that still depends on `@eslint/eslintrc` and resolves
  `@eslint/config-array` onto `minimatch@3`, which is the whole
  `brace-expansion@1` tail. `eslint-plugin-safe-jsx@1.3.1` allows `^10`.
  Installed alone into an empty npm project, safe-jsx resolves eslint 10.8.0,
  `minimatch@10.2.6` and the patched `brace-expansion@5.0.8`. react-native alone
  resolves eslint 9.39.5, `minimatch@3.1.5` and `brace-expansion@1.1.16`.
  Together the `^9` cap wins and the whole install sits on the vulnerable copy.
  The safe-jsx optional-peer publish is therefore a weight fix, taking a
  consumer install of that plugin from 59 packages to 1. Dropping the
  react-native dependency is the security fix. They are separate problems.

  Consumers therefore have a working mitigation today without either publish. On
  npm, `"overrides": { "eslint": "^10" }` (yarn: `resolutions`) takes a fresh
  `npm i magic-oxlint-config@1.2.0` from 78 packages and `brace-expansion@1.1.16`
  to 62 and `5.0.8`. On pnpm the `packageExtensions` stanza is better still: 92
  `.pnpm` directories to 6, with eslint absent and no `brace-expansion` at all.
  Both are in the README.

  **Vendoring the react-native rules, assessed.** The standing suggestion above
  says "vendoring the two rules actually used". Four run at `error` in the
  `react-native` preset: `no-inline-styles`, `no-color-literals`,
  `no-single-element-style-arrays` and `no-unused-styles`. The rule bodies come
  to 231 lines. Three of the four import `lib/util/stylesheet` (492 lines) and
  `lib/util/Components` (407 lines), and `no-unused-styles` gates its whole
  `Program:exit` on `components.all()` being non-empty, so `Components` has to
  come along entire. With `lib/util/variable` (99 lines) that is about 1230 lines
  of third-party MIT code to carry.

  The `jsPlugins` specifier is what stops it. §1 established that oxlint resolves
  those specifiers relative to the _consumer's_ config file. The JS entry points
  therefore resolve to absolute paths, and the five emitted JSON variants fall
  back to bare specifiers that already fail under pnpm's non-hoisted layout.
  Vendored code needs a new specifier that resolves from a consumer's config
  directory across the pnpm, npm and hoisted layouts. Getting it wrong does not
  throw: oxlint carries on and the four rules silently stop reporting across
  eleven repos that just migrated. That is the same worst-failure-shape argument
  behind the `App.tsx` exemption above. Revisit it if upstream stays dormant, and
  prove it with fixtures asserting identical diagnostics on real consumer code
  before shipping.

- **`eslint-plugin-safe-jsx`'s autofix destroys narrowing.**
  `safe-jsx/jsx-explicit-boolean` rewrites `{toast && <Toast {...toast} />}` to
  `{Boolean(toast) && <Toast {...toast} />}`. `Boolean(x)` does not narrow, so
  the spread stays `ToastPayload | null` and `tsc` fails with TS2322 — lint
  passes, and the error has no visible connection to the autofix. `x !== null`
  satisfies the same rule and narrows. Since safe-jsx is a GSTJ package the fixer
  itself can be improved: when the tested operand is also spread or
  member-accessed inside the consequent, emit the comparison instead. Even
  without type information that is a cheap syntactic check. Not done here (other
  repository); the README Gotchas carries the manual check, folded into the
  existing "`--fix` can need two passes" paragraph, which already uses this exact
  rewrite as its example.

- **Upstream bugs to file against oxc.** All verified locally on 1.75.0, all
  worked around in this repo:
  - `unicorn/prefer-export-from`'s fixer deletes statements between re-exports.
  - `unicorn/catch-error-name`'s fixer rewrites shorthand property keys, and does
    not check for an existing binding in scope.
  - `--report-unused-disable-directives` reports a multi-rule
    `/* eslint-disable a, b, c */` as entirely unused when only one of the three
    is, and names no rule. The diagnostic asserts something false in a confident
    tone about code the reader has no other reason to inspect — which is exactly
    the wrong shape for automated migration. Naming the unused rule would make it
    actionable.

- **`func-style: expression` will be noisy on first contact.** It's the
  `prefer-arrow-functions` replacement and named exports are exempt, but repos
  with many top-level `function` declarations will see a wall of errors. It's
  auto-fixable in most cases; run `oxlint --fix` first and read the diff.

- **Category strategy is aggressive.** `style` and `pedantic` at `error` turns on
  ~400 rules, tamed by ~40 opt-outs. Proven in invest-radar and MM, but repos
  with no lint today (seedgen, padrinhos) will see a large first run. Consider
  landing `base` with `categories.style: "warn"` for one PR there, then
  tightening.

- **jsPlugins are alpha and outside semver.** `safe-jsx` and the magic plugin
  both depend on that API surface. Pin oxlint; don't caret-range it.

- ~~**Release automation for these packages isn't wired.**~~ Wired in §9.
  `self-release.yml` runs the check chain, publishes whatever `pnpm -r publish`
  finds missing from the registry, and cuts the tags consumers reference. The
  reusable `release.yml` is still for consumers, and still has no caller.

- ~~**`magic-tsconfig` has no test.**~~ It does now, and it found something the
  reasoning here had waved away. `base.json` shipped `"incremental": true` with
  no `tsBuildInfoFile`, so tsc wrote `<config>.tsbuildinfo` **next to the
  config**, outside `outDir`. A consumer whose build script is
  `rimraf dist && tsc -p tsconfig.build.json` got a correct first build and then
  **nothing** on every subsequent one: exit 0, no output, no error, and the
  failure surfacing at `require("./build")` as MODULE_NOT_FOUND. One repo's
  second `npm pack` produced a tarball with no `lib/` in it.

  Invisible in this repo because `base.json` also sets `"noEmit": true`, so
  magic's own typecheck-only usage never writes output to go stale — only
  consumers who flip `noEmit: false` for a real build are exposed, which is
  exactly what the README's library recipe told them to do.

  `"incremental"` is now gone from `base.json` (and the redundant repeat in
  `nextjs.json`). A base that publishable packages extend should not carry
  build-cache state; a repo that wants it opts in with a scoped
  `tsBuildInfoFile` inside the output directory, so `rimraf <out>` invalidates
  the cache by construction. `packages/tsconfig/test/tsconfig.test.mjs` builds a
  throwaway library, removes the output, builds again, and asserts the second
  build emitted — plus that no variant ever reintroduces `incremental` without
  saying where the cache goes.

- **`magic-tsconfig/internal-package.json` is fine; the README pointing at it was
  not.** It sets `declaration`, `declarationMap`, `noEmit: false` and
  `emitDeclarationOnly: true` — a coherent config for an internal workspace
  package whose JavaScript comes from a bundler, which is what the name says. The
  README's "Plain TypeScript / Node **library**" section prescribed it and paired
  it with `outDir`/`rootDir`, which reads unmistakably as a normal emit config.
  Following that verbatim publishes a package with `main: dist/index.js` and no
  `.js` anywhere. Two repos noticed and extended `base.json` instead; nothing in
  the config or the docs would have stopped them if they had not.

  The section now shows a `tsconfig.build.json` extending `base.json` with
  `noEmit: false`, which is what those repos and every package in this monorepo
  actually ended up writing, and says in one line what `internal-package.json` is
  for. Related, and the reason both this and the `incremental` bug survived to
  publish: `packages/*/tsconfig.build.json` in this repo extended **nothing**, so
  the repo had no dogfooded instance of the recipe it prescribes. They now extend
  `magic-tsconfig/base.json` and add only what a published Node ESM build needs
  on top (`module: nodenext`, `outDir`/`rootDir`, `noEmit: false`, `declaration`,
  `lib: ["ES2023"]`). Every future change to the shared base now has to survive
  this repo's own build before it reaches a consumer.

- **TypeScript 7 (tsgo) does not auto-include `@types/node` under
  `magic-tsconfig/base.json`.** Found in the consumer simulation: a plain-ts
  consumer with `@types/node` installed still fails on `process` / `node:fs`
  (TS2591) until `"types": ["node"]` is set explicitly. The shared base can't
  carry that — it would break every consumer _without_ `@types/node` (TS2688) —
  so the README's plain-ts snippet sets it in the consumer tsconfig. This
  repo's own `tsconfig.build.json`s always did. Worth re-testing on tsgo bumps;
  classic tsc 5.x auto-included `@types/*` here.

- **`func-style: expression` noise, addendum:** `oxlint --fix` may need two
  passes to converge (safe-jsx's `Boolean(x)` rewrite is then rewritten again
  by `unicorn/explicit-length-check`). Run `--fix` until the diff is empty;
  the README's Gotchas section says the same.

---

## 5. `unicorn/filename-case` is on, and the rename is a codemod

Added 2026-07-27, implementing governing directive #5.

### Decision #6 is reversed

The table in §2 counted PascalCase against kebab-case across the migration set,
found three repos of four PascalCase-dominant, and switched the rule off.
Gabriel overruled that: kebab-case everywhere, per the g2i and invest-radar
convention, with the mass rename handled by a codemod shipped from this repo so
every migration agent runs the same script rather than inventing one.

The original reasoning was not wrong about the cost — it was wrong about who
pays it. "Hundreds of files during a migration that is already changing
everything else" is an argument for automating the rename, not for declining to
have a convention. The disposition table entry for `unicorn/filename-case` in §2
is superseded by this section.

`base` now carries:

```ts
"unicorn/filename-case": ["error", { case: "kebabCase", ignore: filenameCaseIgnore }]
```

`case` is stated explicitly although `kebabCase` is the current default, for the
same reason `groups` and `internalPattern` are stated explicitly in the oxfmt
config: a default change upstream must not silently re-case every repo at once.

Real numbers, `git ls-files` across the migration set on 2026-07-27:

| repo                      | lintable files | violations |
| ------------------------- | -------------- | ---------- |
| pegada                    | 638            | 98         |
| morphosis                 | 397            | 71         |
| gabriel-taveira-portfolio | 73             | 19         |
| react-native-magic-modal  | 87             | 13         |
| seedgen                   | 121            | 10         |
| e-card                    | 52             | 9          |
| invest-radar              | 1016           | 0          |
| padrinhos                 | 28             | 0          |
| would-you-rather          | 100            | 0          |

220 renames across the set. invest-radar being already at zero is the strongest
argument that the convention is livable — it is the largest repo in the list.

### What the rule actually does, verified

Every claim here comes from running oxlint 1.75.0 against generated trees, not
from the upstream ESLint rule's documentation, which describes something
stricter.

**Only the segment before the first dot is checked.** `charlie.Test.ts` passes;
`Bravo.test.ts` fails. A `.stories`, a `.config`, a `.ios` suffix is never
inspected. (`multipleFileExtensions: false` would inspect `Bravo.test` instead;
we leave the default.)

**Leading and trailing underscore runs are trimmed before the check.**
`_layout.tsx`, `__mocks__.ts` and `alpha_.ts` pass; `foo_bar.ts` does not.

**The only things rejected are uppercase letters, spaces, and interior
underscores.** Everything else passes, including every punctuation character
tested (`[ ] + $ ( ) @ ~ ! & % = , ; # ^ { } ' \` — · —`), repeated and leading
hyphens (`a--b.ts`, `-x.ts`), and caseless scripts (`日本.ts`). The upstream
ESLint rule uses `^[a-z\d]+(-[a-z\d]+)*$`; assuming that here produces false
positives on every file-based router in the set.

A 765-name differential run pinned the predicate to zero disagreements:

```
stem      = basename up to the first "."
trimmed   = stem with leading and trailing "_" runs removed
valid iff no character of `trimmed` is uppercase, a space, or "_"
```

**Uppercase is Unicode, not ASCII.** `ÉZ` is a word boundary to oxlint (it is
Rust, asking `char::is_uppercase`), so `ZÉaA.ts` wants `z-éa-a.ts`. An
ASCII-only `[A-Z]` implementation produces `zéa-a.ts` — a name the rule still
rejects. Caught by the differential test, not by reading.

**The diagnostic carries the target.** `help` is
`Rename the file to 'pascal-thing.ts'`, so nothing downstream has to reimplement
the word-splitting. Its corners: `S3.ts` → `s-3.ts`, `V2.ts` → `v-2.ts`,
`AppV2.ts` → `app-v-2.ts`, `OAuth2Client.ts` → `o-auth2-client.ts` (an uppercase
letter followed by a digit is a boundary).

**Options are strictly validated.** The rule accepts exactly `case`, `cases`,
`ignore`, `multipleFileExtensions`; an unknown key or an unknown case name is a
fatal config error, as is an unparseable regex in `ignore`. `ignore` entries are
regexes matched **unanchored against the basename only** — `^Pascal` suppresses
`src/PascalThing.ts`, `^src/Pascal` matches nothing. The schema types the rule as
`DummyRule` (no typed options), so none of this is discoverable from the schema;
it came from probing the binary.

### Exemptions, and where they live

The rule is now the thing that decides whether a filename is a bug, so every
framework that derives behaviour from a filename had to be checked against a
real tree. `packages/oxlint-config/test/variants.test.mjs` asserts all of it in
all five variants rather than trusting the analysis.

**Almost nothing needed an exemption.** Next.js App Router reserved names
(`page`, `layout`, `loading`, `error`, `not-found`, `global-error`, `template`,
`default`, `route`, `sitemap`, `robots`, `manifest`, `opengraph-image`,
`apple-icon`, `middleware`, `instrumentation`) are already kebab-valid. Pages
Router `_app.tsx` and `_document.tsx` pass because underscores are trimmed.
expo-router's `_layout.tsx`, `+not-found.tsx` and `+html.tsx` pass because `+` is
not a rejected character. Route groups `(marketing)`, parallel routes `@modal`
and intercepting routes `(.)photo` are _directories_, and the rule only looks at
basenames.

Three real exemptions:

- **`ignore: ["\\["]` in `base`.** Dynamic segments carry a _route parameter
  name_ between brackets, and `[postId].tsx` / `[userId].tsx` are camelCase by
  universal convention. Kebab-casing one changes `params.postId` to
  `params.post-id` — which is not even a valid identifier — so this is the one
  case where the rule is straightforwardly wrong. Costs nothing in a repo with
  no bracketed filenames, which is why it sits in `base` rather than in the
  `next` and `expo` variants separately.

- **`__mocks__/**` override, `off`.** jest and vitest resolve `__mocks__/<x>` by
  matching `<x>` against the module being mocked, so `__mocks__/AsyncStorage.ts`
  keeps that name for exactly as long as the package is called that. Narrower
  than the existing test-file override on purpose: `button.test.tsx` is ours and
  does get renamed.

- **`^App\.` in `react-native` (and therefore `expo`).** Bare RN's `index.js`
  template imports `./App`, and classic pre-expo-router Expo apps point `main` at
  `node_modules/expo/AppEntry.js`, whose `import App from "../../App"` is inside
  a dependency and unreachable from any codemod. Renaming to `app.tsx` therefore
  _works locally_ — APFS is case-insensitive — and fails only once the build runs
  on Linux (EAS, CI). That is the worst available failure shape, so `App` is
  exempt by config rather than left to a migration agent's judgement. Asserted to
  be exempt in `react-native` and `expo` and still reported in `base`, `react`
  and `next`, which have no RN entry point to protect.

  **The codemod's matching skip is conditional, and had to be.** The first
  version skipped every `App.*` unconditionally and the dry-runs immediately
  showed why that is wrong: e-card and morphosis are Vite web apps whose
  `src/App.tsx` is reached by an ordinary `./App` from `main.tsx`. Those repos
  use the `react` preset, which does _not_ exempt `App`, so the linter demands
  the rename and a codemod that refuses it produces exactly the orphaned-error
  state this whole design is meant to prevent. `magic-kebab` now walks up to the
  nearest `package.json` and only skips `App.*` when `react-native` or `expo` is
  a declared dependency there — matching, package by package, which preset that
  code would be linted with.

Remix / React Router file routes (`$postId.tsx`) would want `ignore: ["^\\$"]`.
Not in `base` — nothing in the migration set uses them, and `base` should not
accumulate exemptions for frameworks nobody runs. Add it locally.

**The `__mocks__` override has to be last, and is duplicated to stay that way.**
An `overrides[]` entry that omits `plugins` re-activates category rules for the
files it matches — the same behaviour documented in §2 for the jest rules — and
`unicorn/filename-case` is a `style` rule. So a later, broader override can
switch it back on for `__mocks__` from underneath. `mocksFilenameCase` is
exported from `base.ts` and appended as the final override of every variant;
`variants.test.mjs` asserts each emitted JSON ends with it.

### magic-codemods / magic-kebab

New package. `bin: magic-kebab`, ts-morph based. Full interface in
`packages/codemods/README.md`; the decisions worth recording here:

**Detection defers to oxlint.** The default `--detect oxlint` runs the target
repo's own linter and reads its `unicorn(filename-case)` diagnostics, taking the
rename target from the diagnostic's `help` text. A codemod that reimplements a
lint rule and then disagrees with it is worse than no codemod, and this makes
disagreement structurally impossible — the repo's `ignore` list, `overrides` and
`ignorePatterns` all apply because the linter is the one answering.
`--detect builtin` exists for repos that have not adopted the preset yet, and
`test/kebab.test.mjs` holds it to oxlint over a generated corpus.

**A plain lint run, not a scoped one.** `oxlint -A all -D unicorn/filename-case`
looks like the fast path and is wrong: verified on 1.75.0, `-D <rule>` re-enables
the rule with its **default options** and discards the config's `ignore` list, so
a scoped run reports every `[postId].tsx` in the repo. `overrides` survive it;
rule options do not.

**Rename via a temporary name, unconditionally.** On APFS `Button.tsx` and
`button.tsx` are the same path. `git mv` between them is refused, or with `-f`
becomes a no-op that still updates the index — producing a commit that claims a
rename the working tree never performed, and a file that materialises only when
someone checks out on Linux. Doing the two-step for every rename rather than only
for case-only ones keeps one code path, and it is invisible in history: git
records no rename in a commit, it infers renames from content similarity at diff
time, so two `git mv`s before one commit produce one rename in that commit.

**Rewrite first, move second.** Specifiers are rewritten to point at names that
do not exist yet, then the files are moved to make them true. The reverse order
resolves specifiers against a half-renamed tree where `./Button` is ambiguous
between the file that moved and the one that has not. Between the phases the tree
does not typecheck, which is fine — nothing observes it, and the clean-tree
precondition means one `git checkout .` undoes both.

**Refuses a dirty tree, untracked files included.** `git checkout .` has to be a
complete undo, and it only is when the tree started clean. A `git mv` onto an
untracked path clobbers it silently.

**Only basenames change, never directories.** This is the invariant that makes
specifier rewriting tractable: only the last segment of any specifier is ever
touched, and its extension — present, absent, or `.js` standing in for `.ts` —
is preserved as written.

**Report, never guess.** Computed specifiers (`import(`./${name}`)`),
`moduleNameMapper` regexes, bundler aliases, `package.json` `main`/`exports`, and
prose in `.md` are found and printed under `NEEDS REVIEW`, never edited. A
`moduleNameMapper` key is a regex whose escaping belongs to its author; a
`package.json` `exports` path is a published contract.

**Two things that should have been in that list from the start** (added
2026-07-27, both from real breakages the dry run did not mention):

- **Bare string literals that resolve to a file being renamed.** An Expo config
  plugin (`plugins: ["./plugins/withExpoModulesCoreSwiftStrictConcurrency"]` in
  `app.config.ts`), the argument to a repo's own `require`-wrapper, a workspace
  subpath in a route manifest. None of them is a specifier to any AST pass, and a
  string whose value resolves to a rename source is strictly _easier_ to detect
  than the computed `import()` the README already promised to report. The Expo
  case is the worst shape available: it only fails on Linux/EAS, because APFS
  resolves the stale path fine — so a migration agent verifies green locally and
  ships a broken build. That is the same trap the third-name rename dance exists
  to prevent, so the reasoning was already house doctrine; it just was not
  applied here.

- **Alias-shaped specifiers nothing could resolve.** See the tsconfig note below.

**tsconfig discovery walks the workspace.** It used to look for
`tsconfig.json` / `tsconfig.base.json` / `jsconfig.json` **at the run root
only**. In a monorepo the root usually has none, and the codemod printed

```
tsconfig: (none found - path aliases will not be rewritten)
```

and then rewrote every relative specifier while leaving every `@/…` import
pointing at a file it had just renamed. Two repos hit it. Neither agent called it
a silent failure, because the line _is_ printed — both read it as "this repo has
no aliases" rather than "I am about to rewrite half your imports", which in a
monorepo is almost always the wrong reading. `--write` would have left an example
app broken in one and three imports pointing at a deleted file in the other, and
`--strict` said nothing.

Two layers, and the second is the one that matters:

1. Discovery reads `paths` from the root, from every package matched by
   `pnpm-workspace.yaml`'s `packages` globs, and from a generic
   `*/tsconfig.json` / `*/*/tsconfig.json` sweep, merging all of them.
   `--tsconfig` is now repeatable, and a `--tsconfig` pointing at a file that
   does not exist is an error rather than a silent fall-through to discovery.
2. Independently of (1): an alias-shaped specifier (`@/`, `~/`, `#`) whose last
   segment names a file being renamed, that **no** loaded `paths` entry resolves,
   goes under `NEEDS REVIEW` and makes `--strict` exit non-zero. This is the
   safety net — a repo can alias through a bundler config no tsconfig walk will
   ever find, and a destructive operation should not be quiet about that.

**An unmatched `--rename` is fatal.** Keys are full basenames _including the
extension_: `--rename zodI18n.ts=zod-i18n.ts` works, `--rename zodI18n=zod-i18n`
used to be accepted, silently ignored, and the file renamed to the codemod's own
target instead — exit 0, no warning. The requirement was discoverable only by
example in the README and stated nowhere. Silence was the whole bug: `--rename`
exists specifically for the files a human looked at and overruled (CONFLICTS
resolution, `S3.ts`), so an ignored key discards that decision on exactly the
files someone thought about. It now errors, suggests the key you meant when the
only difference is a missing extension, and exits non-zero. A key naming a file
the detector never reported is the same error — under `--detect oxlint` the
preset already exempts `__mocks__/AsyncStorage.ts`, and "your override was inert"
is worth a sentence rather than nothing.

**A local module's `__mocks__` moves with it.** `__mocks__/Button.ts` next to a
`Button.tsx` being renamed is paired up and given the same stem, because jest
would otherwise silently stop applying it. A `__mocks__` entry with no
same-named sibling is a package mock and is skipped with a printed reason.

Dry-run numbers against the real migration set (`--detect builtin`, so the
repo's own config is not consulted): pegada 96 renames / 2 skipped, morphosis 70,
gabriel-taveira-portfolio 19, react-native-magic-modal 13, seedgen 10, e-card 8.
**Zero conflicts anywhere**, which is the number that mattered — a conflict is
the one outcome a migration agent cannot resolve without thinking.

Also run for real against a throwaway clone of e-card: 8 renames including the
case-only `App.tsx` → `app.tsx`, 8 specifier rewrites, on-disk casing correct, no
temp files left behind, `git status` showing `R` for every move, and
`git log --follow -- src/app.tsx` reaching back through five commits to `init`
with `R086 src/App.tsx src/app.tsx` in `--name-status`.

Verified end to end against a throwaway git repo carrying one instance of each
hazard — case-only rename, alias imports, barrel re-exports, dynamic `import()`,
a platform-variant trio, both kinds of mock, a route parameter, a
`moduleNameMapper`, a computed import. 45 assertions, including that
`git log --follow` still reaches back past the rename (`R100 old -> new` in
`--name-status`), that `tsc --noEmit` passes afterwards, that oxlint's
filename-case goes silent, and that `--dry-run` leaves the tree byte-identical.

### Dogfood outcome: zero renames

This repo was already entirely kebab-case — 89 tracked files, 0 violations under
both detectors, before and after turning the rule on. So the rule went on, the
full check chain stayed green, and the codemod's honest result here is
"Nothing to rename."

That is a weak dogfood and worth saying plainly rather than dressing up. The
fixture repo in `packages/codemods/test` is the real proving ground, and the
`--dry-run` numbers in the table above are the real evidence the thing works on
the repos it was built for.

One thing the repo's own lint did surface while writing the package:
`oxc/no-map-spread` and `unicorn/prefer-spread` are in direct conflict on
`flatMap((x) => [x, ...f(x)])` — the first rejects the spread, the second rejects
the `.concat()` you would reach for instead. Both are on via the categories.
The way out is a plain loop; noted in `resolve.ts` where it bites.

---

## 6. Every `@shopify/*` rule, dispositioned

Added 2026-07-27, implementing governing directive #6. The first pass dropped
six of the eight Shopify rules the incumbent config used, four of them with a
one-line reason. Gabriel overruled that: each rule gets a real disposition —
native equivalent, port, selective jsPlugin, or a documented drop.

### Verification basis

Everything below was run. `@shopify/eslint-plugin@50.0.0` was installed into a
scratch directory and loaded under oxlint 1.75.0 as
`jsPlugins: [{ name: "shopify", specifier: "@shopify/eslint-plugin" }]`.

| Shopify rule                   | Under oxlint 1.75.0                          |
| ------------------------------ | -------------------------------------------- |
| `prefer-early-return`          | Fires                                        |
| `no-namespace-imports`         | Fires                                        |
| `restrict-full-import`         | Fires                                        |
| `jsx-no-hardcoded-content`     | Fires                                        |
| `react-require-autocomplete`   | Fires                                        |
| `react-hooks-strict-return`    | Fires                                        |
| `no-ancestor-directory-import` | **Fails** — `unable to load resolver "node"` |
| `strict-component-boundaries`  | **Fails** — same                             |

New against what §1 recorded: `no-ancestor-directory-import` fails on the
resolver too. §1 only knew about `strict-component-boundaries`.

**Option (c) — load the plugin selectively — is rejected for every rule, on
weight rather than compatibility.** `@shopify/eslint-plugin@50` installs **262
transitive packages, 97 MB**: `eslint-plugin-import-x`, `eslint-plugin-jest`,
`eslint-plugin-jsx-a11y`, `typescript-eslint`, `prettier`,
`eslint-config-prettier`. That is a second copy of the ESLint ecosystem landing
in every consumer of a config whose entire reason to exist is that oxlint
replaced it. Six rules working is not worth reinstalling the thing we left.

### Disposition

| Shopify rule                   | Disposition | Where it lives                                              |
| ------------------------------ | ----------- | ----------------------------------------------------------- |
| `prefer-early-return`          | Ported      | `magic/prefer-early-return` (existed; fidelity-fixed)       |
| `no-ancestor-directory-import` | Ported      | `magic/no-ancestor-directory-import`                        |
| `react-require-autocomplete`   | Ported      | `magic/react-require-autocomplete`                          |
| `react-hooks-strict-return`    | Ported      | `magic/react-hooks-strict-return`                           |
| `no-namespace-imports`         | Native      | `import/no-namespace` — already on in `base` and `react`    |
| `restrict-full-import`         | Native      | `no-restricted-imports`, per-repo config                    |
| `jsx-no-hardcoded-content`     | Native      | `react/jsx-no-literals`, off in `react`, snippet documented |
| `strict-component-boundaries`  | Dropped     | `no-restricted-imports` `patterns`, per-repo config         |

### `prefer-early-return` — a real divergence, fixed

The port already in the repo treated _any_ braceless consequent as a single
statement, so at `maximumStatements: 0` it reported `() => { if (done) return; }`
and `() => { if (bad) throw e; }` — telling the author to invert a guard clause
into itself. Upstream's `isOffendingConsequent` counts a braceless consequent
only when it is an `ExpressionStatement` **and** `maxStatements === 0`. Matched
exactly now:

```ts
if (consequent.type === "BlockStatement") {
  if ((consequent.body ?? []).length <= maximumStatements) return;
} else if (
  consequent.type !== "ExpressionStatement" ||
  maximumStatements !== 0
) {
  return;
}
```

One divergence stays, documented in the source and the README: the default
`maximumStatements` is `0` here and `1` upstream. `0` is what the incumbent GSTJ
ESLint config passed, so a bare `"error"` means what those repos already meant.

### `no-namespace-imports` — native, and stricter than the original

`import/no-namespace` with `["error", { ignore: ["react", "@radix-ui/*"] }]`
passes `react` and `@radix-ui/react-dialog`, reports `react-native` and
`node:path`. Already wired: `base` bans it outright, `react` re-declares it with
the allow list the old config carried, the test override turns it off (namespace
imports are how you spy on a module).

Worth knowing, though it needs no action: Shopify's `allow` is
`new RegExp(allowed.join("|"))` — unanchored substring matching. `allow:
["react"]` therefore also permitted `react-native`, `react-dom`, `preact` and
`./my-react-thing`. oxlint's globs are exact-match-with-`*`, so the replacement
is tighter than what it replaces, not looser.

### `restrict-full-import` and `strict-component-boundaries` — project config

Which packages are off-limits, and where a component's boundary is, are project
decisions. Directive #3 keeps both out of the shared presets. Both snippets are
in the plugin README and both are executed by `fixtures/adversarial/shopify`, so
a README that stops working fails the build rather than the next migration.

Verified on 1.75.0: `{ name: "lodash", importNames: ["default"] }` reports both
`import lodash from "lodash"` and `import { default as lodash } from "lodash"`,
and leaves `import { debounce } from "lodash/debounce.js"` alone. The namespace
half is `import/no-namespace`'s job already. Upstream's `require()` branch has no
native equivalent and does not come up in ESM/TS.

`strict-component-boundaries` is the one true drop. It cannot load, and its core
heuristic — a PascalCase path segment means "another component" — is dead under
the kebab-case filename convention adopted in §5. `no-restricted-imports`
`patterns` with `group: ["**/components/*/**"]` reports
`../components/Card/internal/thing` and leaves `../components/Card` alone.

### `no-ancestor-directory-import` — the resolver bought nothing

The old disposition ("expressible with `no-restricted-imports` patterns") does
not survive contact: matching `.`, `..`, `../..`, `../index`, `../../index.ts`
and so on means enumerating an unbounded ladder of globs.

Reading upstream's `relative(filename, resolvedSource)` logic, the exact set it
reports is _specifiers composed only of `.`/`..` segments with an optional
trailing `index` basename_ — decidable from syntax, no resolver needed. Two
divergences, both documented: upstream stays silent when a specifier fails to
resolve (this reports; such an import does not typecheck anyway), and this
additionally covers the re-export forms (`export * from ".."`,
`export { x } from "."`) that upstream missed by hooking `ImportDeclaration`
alone. Dynamic `import("..")` is not covered. `index.module.css` has basename
`index.module`, not `index`, so CSS-module imports are not swallowed.

**Dogfood finding, and why it stays opt-in.** Turning this on for this repo
reports three real hits: `packages/codemods/src/cli.ts` and
`packages/oxfmt-config/src/cli.ts` importing `./index.ts`. Both are true
positives by the rule's definition and neither is a cycle — `runKebabCodemod`
and the oxfmt variants are _defined_ in `index.ts`, so there is no other file to
name. That is a fair illustration of why the rule is a policy and not a bug
detector, and it is the reason it is not a candidate for `base` despite being
general enough to live there.

### `react-require-autocomplete` — `jsx-a11y/autocomplete-valid` is not a substitute

Checked against 1.75.0: `jsx-a11y/autocomplete-valid` validates the _value_ of an
`autoComplete` attribute and says nothing when the attribute is missing, which is
the entire case. An autofillable `<input>` with no `autoComplete` gets whatever
the browser guesses, which is how a password manager fills an address into a
one-time-code box. `autoComplete="off"` is an accepted answer; the rule wants the
decision made.

Two divergences from upstream, both cutting false positives: an element with a
spread attribute is skipped (`autoComplete` may be in the spread), and a computed
`type={kind}` is skipped where upstream falls back to treating it as text.
Options: `inputComponents`, for components that render an `<input>` and forward
props.

### `react-hooks-strict-return` — one path dropped deliberately

A hook returning `[a, b, c, d]` makes every call site memorise a positional order
nothing checks. Two is the limit that keeps `const [value, setValue] = useThing()`
readable; object returns are never reported at any size, which matches upstream
and is the escape hatch.

Upstream additionally resolves an indirect return (`const pair = [a, b, c];
return pair;`) through scope analysis. That path is dropped: it needs the array
literal in scope and assigned to the returned identifier, which a `useX` hook
rarely looks like. A `SpreadElement` counts as one value rather than being
expanded. Both choices err toward silence. Options: `maximumReturnValues`
(default `2`; upstream hardcodes it).

### `jsx-no-hardcoded-content` — native, off, and two gotchas

`react/jsx-no-literals` covers it and is off in the `react` preset: it is an i18n
rule, and it only pays for itself once a repo has somewhere to move the strings
to. Nothing in the migration set does. The configured snippet is in the plugin
README.

Two things found while verifying it on 1.75.0, both of which cost time:
`elementOverrides` needs `allowElement: true` to exempt an element —
`{ "noStrings": false }` reads like it should work and silently does nothing. And
`restrictedAttributes` does **not** narrow checking to the attributes you list;
it reports every string attribute and merely uses a different message for the
listed ones, so `ignoreProps: true` is what keeps the rule on children.

### Where this is wired

Nowhere in the presets, except the two that were already there
(`import/no-namespace` in `base` and `react`) and the one explicit opt-out
(`react/jsx-no-literals` in `react`, now carrying its provenance in a comment).
The plugin's "nothing is on by default" invariant holds with seven rules exactly
as it did with four, and §10 keeps it holding at eight.

What is new is that all of it is executed. `fixtures/adversarial/shopify` runs
every disposition — the four ported rules and the four native snippets — with
positive and negative cases for each, so a README snippet that stops firing fails
`pnpm run check` rather than the next repo to paste it. `scripts/validate-rules.mjs`
gained a second pass that resolves every `magic/*` name written in any config or
doc against the plugin's actual rule map, and fails on a rule the plugin ships
but the README never documents.

---

## 7. What the 1.0.0 consumers found

Added 2026-07-27. Eleven repos migrated onto the published 1.0.0 packages and
reported back with repros. Twenty-six findings; every one is fixed or explicitly
deferred with a reason. The per-topic detail lives with the decision it corrects
— §1 for the config-shape and version claims, §2 for rule dispositions, §4 for
the gaps, §5 for the codemod. This section is the index and the pattern.

### The pattern worth naming

Four of the five worst findings share one shape: **a claim that was reasoned
rather than executed.**

- "`extends` drops `ignorePatterns` … documented in both READMEs" — it was
  documented in one, and seven of eleven repos shipped with zero ignore
  patterns.
- "`oxlint-tsgolint` requires TypeScript 7" — inferred from "built on
  typescript-go", which is precisely the reason it does not. Verified firing on
  `typescript@6.0.3`.
- "an override entry that omits `plugins` re-activates category rules" — close
  enough to be useful inside the presets, wrong about the thing consumers hit.
- "`MagicOxlintConfig` … consumers pass these objects into `defineConfig()`,
  which is where the real typing happens" — nobody had ever compiled that
  sentence. `plugins?: string[]` is _wider_ than oxlint's literal union, so the
  README's own Step 2 failed `tsc --noEmit` in every repo that put
  `*.config.mts` in a tsconfig `include`. This repo missed it because `typecheck`
  is `turbo run typecheck`, per package, and the root config file is in no
  package's `include`.

The fifth, `incremental` without `tsBuildInfoFile`, is the same failure in a
different key: invisible here because `base.json` also sets `noEmit: true`, so
this repo never wrote output that could go stale.

So the guard added for each is an executed one, not a sentence:

| Finding                                      | The check that would have caught it                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `MagicOxlintConfig` not assignable           | `fixtures/adversarial/typecheck` (`tsc --noEmit` on the README's own snippets, every variant) |
| `incremental` without a build-info path      | `packages/tsconfig/test` — build, `rm -rf` the output, build again                            |
| override `off` silently ignored              | `fixtures/adversarial/override` — both shapes, both directions                                |
| App Router rules with no passing shape       | `fixtures/adversarial/next` — page, layout, middleware, pages router                          |
| `prefer-export-from` deleting exports        | `fixtures/adversarial/base/src/derived-reexport.ts` under `--fix-suggestions`                 |
| the codemod's monorepo/string-literal misses | `packages/codemods/test` — a second fixture repo with no root tsconfig                        |

### Everything else, in one place

**Autofixers that break the code they fix.** Five of them, all verified, all now
off or reconfigured: `unicorn/prefer-export-from` (deletes exports),
`unicorn/catch-error-name` (rewrites shorthand keys, losing `{ cause }`),
`unicorn/no-array-reverse` (emits ES2023 the shipped tsconfig rejects),
`typescript/consistent-type-definitions` (interface has no implicit index
signature), `unicorn/prefer-string-raw` (breaks Next's static analysis of
`middleware.ts`). §2 has each one. The common thread is that a rule being _right_
about style says nothing about its fixer being safe, and the preset chooses to
run it either way.

**Documentation that only fails downstream.** `--fix-suggestions` was not
mentioned in the README at all, so an agent that discovered it reasonably assumed
it was the same class of safe as `--fix`. `--report-unused-disable-directives`,
which the README _does_ prescribe in the standard scripts, reports a multi-rule
directive as entirely unused when one rule is — the diagnostic asserts something
false, confidently, about code the reader has no other reason to inspect. Both
are now Gotchas.

**pnpm 11.** Four separate walls (gated install scripts erroring rather than
warning, `onlyBuiltDependencies` → `allowBuilds` and list → map, the dropped
`pnpm` key in `package.json`, the 24h release quarantine), plus one that is
unconditional for Vercel-deployed repos and unfixable from inside the repo. None
of it is a magic defect and all of it is magic's to document, because magic pins
the version. It also turned out magic had **already solved the quarantine for
itself** in `pnpm-workspace.yaml` without telling anyone. The Renovate preset now
carries `minimumReleaseAge: "3 days"` to match, so the two halves of the
toolchain stop disagreeing by default.

### Not fixed here

- `eslint-plugin-safe-jsx` 1.3.1 with an optional `eslint` peer, and the
  narrowing-preserving autofix. Both are changes in another repository plus a
  publish. §4.
- A `vitest` preset variant. §4.
- `eslint-plugin-react-native`'s required `eslint` peer — upstream, or vendor the
  two rules used. §4.
- The four upstream oxc bugs. Worked around; filing them is the follow-up. §4.

---

## 8. What the 1.1.0 upgrade found

Added 2026-07-27, same day as §7 and the same eleven repos, one round later.
They upgraded 1.0.0 → 1.1.0 and reported back. All eleven ended green; none of
this was release-blocking. Two were real defects.

### `extends` drops three fields, not one — and `--print-config` hides which

Seven of the eleven reports were about the same thing, and between them they got
it wrong in both directions. §1 said `extends` drops `ignorePatterns`. Five repos
ran `oxlint --print-config` on an `extends`-shaped config, saw `categories: {}`,
`env: { builtin: true }`, `globals: {}`, no `jsPlugins` and every rule stripped
of its options, and concluded the preset was being gutted. Two of those five then
proved by probe that behaviour was identical and filed it as a printer bug. Two
other repos took the printed output at face value and reported a much larger
defect than exists.

Neither conclusion was right. Executed, rule by rule, on oxlint 1.75.0:

| Field            | Survives `extends`? | What `--print-config` says        |
| ---------------- | ------------------- | --------------------------------- |
| `rules`          | yes                 | severities only, options stripped |
| `categories`     | **yes**             | `{}`                              |
| `overrides`      | yes                 | rendered                          |
| `plugins`        | yes                 | rendered                          |
| `jsPlugins`      | yes                 | absent                            |
| `ignorePatterns` | **no**              | accurate — the only one           |
| `env`            | **no**              | `{ builtin: true }`               |
| `globals`        | **no**              | `{}`                              |

The probes that settle it, all in `fixtures/adversarial/extends`:

- **`categories` survive.** `typescript/array-type` is in no preset's `rules`; it
  is on solely because `categories.pedantic` is `error`. It fires under
  `extends`. Deleting `categories` from a flattened config silences it. So the
  printed `{}` is post-expansion state, not a merge result.
- **Rule options survive.** `consistent-type-definitions` reports in the `"type"`
  direction (oxlint's own default is the opposite), `filename-case` leaves
  `[postId].ts` alone, `no-restricted-properties` carries its message.
- **`env` and `globals` do not.** `document = 1` in a file linted through
  `extends` did not fire `no-global-assign` — an `error` rule in every variant —
  because `env: { browser: true }` never arrived. Same for `__DEV__` from the
  React Native presets' `globals`. **Nobody found this**, because the printer
  reports it in exactly the same shape as the six fields that are fine, and
  because the two repos that probed happened to probe rules that do not consult
  the globals table.

That last line is the reason `--print-config` is now documented as unusable for
this: it is not merely noisy, it is noisy in a way that camouflages the real
losses. The check the READMEs told people to run could not have found the bug the
READMEs were wrong about.

### Can the packages defend themselves?

Partly, and the part that works is shipped in 1.2.0.

**Detecting the misuse at runtime: no.** A consumer's
`defineConfig({ extends: [base] })` imports our module and puts the object in an
array. There is no observable difference, from inside the imported module,
between that and being the default export — no callback, no `this`, no call into
our code at all. `defineConfig` belongs to `oxlint`, so we cannot wrap it (a
`defineConfig` exported from `magic-oxlint-config` would only be used by people
who already read the docs). Property getters fire identically down both paths.
oxlint reads the object and merges it in Rust. Nothing about the misuse is
visible to JavaScript we control, so a runtime warning is not possible. Recorded
here so it stops being re-proposed.

**Restoring the dropped fields: two of three.** `overrides` survive `extends`,
and an override entry accepts `env` and `globals`. So every variant now mirrors
its final `env`/`globals` into a `files: ["**"]` entry (`withEnvCarrier` in
`src/internal.ts`), and both fields reach the linter down either path. Verified:
identical diagnostics on three fixture trees through the supported forms — the
carrier adds nothing and removes nothing there — and `no-global-assign` firing
under `extends`, where it did not before. Env entries accumulate across matching
override entries rather than replacing one another, so a consumer's own override
on the same files cannot clear it. Composing variant on variant would stack one
carrier per level, so `withEnvCarrier` drops any it finds before adding one.

This also fixes JSON consumers, who have no `extendConfig` and no choice.

`ignorePatterns` is the one that cannot be defended: oxlint has no per-override
ignore, and an `overrides` entry that turns every rule off for `node_modules/**`
would still parse the tree and cannot express "all categories off". So `extends`
stays undocumented, and the one-line re-export stays the recommendation.

### `nextjs.json` and `incremental` — 1.1.0's collateral damage

Three repos independently: after the bump, the first `next build` rewrote the
consumer's `tsconfig.json`, adding `"incremental": true` and reformatting the
whole file in Next's own JSON style (every array expanded one element per line).
The next CI run then failed at the format step on a file nobody had edited, with
nothing pointing back at a tsconfig bump.

Read at the source (`next/dist/lib/typescript/writeConfigurationDefaults.js`):
Next iterates its suggested compiler options and, for each one **not present in
the resolved config**, writes it into the raw `tsconfig.json` and rewrites the
file. `incremental` is on that list for any TypeScript ≥ 4.4.2. Of Next's
suggested options — `target`, `lib`, `allowJs`, `skipLibCheck`, `strict`,
`noEmit`, `incremental` — `incremental` was the only one this package stopped
setting.

So the fix is to set it, in `nextjs.json` only. §7's reasoning for removing it
("a `rm -rf dist && tsc` emitted nothing at all") is about emit, and `nextjs.json`
is `noEmit`; the case cannot arise. Next redirects its own build info to
`.next/cache/.tsbuildinfo` (`runTypeCheck`), so the only file a consumer sees is
the `tsconfig.tsbuildinfo` their own `tsc --noEmit` writes — hence `*.tsbuildinfo`
stays in a Next repo's `.gitignore`, reversing part of §7's advice.

`tsBuildInfoFile` cannot be shipped here to tidy that up: relative paths in an
extended config resolve against the file that declares them, verified — the entry
would write inside `node_modules/magic-tsconfig`.

`packages/tsconfig/test` keeps the "no `incremental` without `tsBuildInfoFile`"
rule for every other variant and exempts this one by name, with the reason and
an assertion that the variant is still `noEmit` — so the exemption dies the day
that stops being true.

### The `CHANGELOG.md` ignore, reconsidered

§7 added `**/CHANGELOG.md` to the oxfmt ignore list because generated changelogs
are rewritten by their generator and formatting one makes every future release PR
fail the check it created. One repo hand-maintains its changelog and formats it
on purpose. Its `version` script was
`node tools/changelog.mjs && oxfmt CHANGELOG.md`, and oxfmt 0.60.0 exits **2**
when every path it was handed is excluded — so `npm version` would have died
after rewriting the changelog and before staging it, at release time, for
whoever cut the next release.

The default stays. Generated is the common case, the failure mode of getting it
wrong is permanent, and the failure mode of the ignore is a one-line fix. What
was missing was the one line, so 1.2.0 exports `withoutIgnorePatterns(config,
patterns)` and the exit-2 behaviour is documented in three places. The helper
throws on a pattern the config does not ignore rather than returning it
unchanged: this is a config format where unknown keys and unmatched patterns
both fail open, and a silent no-op is the failure mode the whole package keeps
warning about.

Narrowing the pattern instead (`**/CHANGELOG.md` only when a changelog generator
is in `devDependencies`, say) was considered and dropped — a formatter config
that reads `package.json` to decide what it formats is a worse surprise than
either default.

### `typescript/consistent-type-definitions` stays on

Four reports about its autofix, three of them reproduced here exactly:

- `interface Props extends A, B {}` (empty body, two bases — the shadcn/cva prop
  shape) fixes to `type Props = {} & A & B`, and the same preset then reports
  `typescript(ban-types)` on the `{}`. `--fix` does not converge: it trades one
  error for another, run after run.
- Inside `declare module "x" { interface Y {} }` the fix produces a type alias
  that cannot merge with the upstream interface, so the augmentation silently
  stops applying.
- The emitted alias has no terminating semicolon, so `oxlint --fix` output alone
  fails `oxfmt --check`. Valid TypeScript via ASI, so typecheck and tests never
  notice; only a repo whose CI runs the two as separate gates sees it.

The fourth — an `interface X extends Y` where `Y` carries an index signature
widening a declared member to `any` after conversion — did **not** reproduce
minimally, on TypeScript 5.4.5 or on tsgo 7.0.2. Indexed access and destructuring
both gave the same non-`any` type from the interface and the intersection. The
reporting repo traced a real `any` through four files to a real conversion, so
something in their library types (reanimated / react-native-svg / styled props)
makes it happen; the mechanism is not the one stated. Recorded as unreproduced
rather than adopted or dismissed.

None of this changes the rule's disposition. The direction it enforces is the
safe one — §2 has why `type` → `interface` breaks index-signature assignability
at every use site — and oxlint offers no lever to exempt `extends` clauses or
`declare module` bodies. So: rule stays at `error`, README Gotchas carries the
three shapes to convert by hand, and `declare module` gets a per-site disable.

One consequence worth stating for library authors, since it surfaced as a public
API question: an exported `interface` can be declaration-merged by a consumer, a
`type` alias cannot. Assignability, `extends` and `implements` are unaffected.
Nothing in the migration set documented merging as supported, but the conversion
does remove the possibility, in someone else's repo.

### Everything else, and what was left alone

**pnpm 11, again.** Five repos hit the same wall upgrading inside the quarantine
window: swapping `minimumReleaseAgeExclude` to the new versions in one edit
fails, because pnpm verifies the **committed lockfile** against the policy before
it resolves anything, so it rejects the versions you are leaving. Both sets have
to be listed for the one install that rewrites the lockfile. §7 documented first
adoption and not the upgrade, which is the case every repo hits on every release.
Now in the README, along with three smaller pnpm 11 traps the same round
surfaced: a quarantined install silently downgrades rather than failing (one
repo's "26-line" lockfile diff came back 253 lines), `pnpm dedupe --check` is not
read-only on 11.17.0, and pnpm 10.34.5 warns that it ignores the `pnpm` field in
`package.json` while still honouring it — which must not be "fixed" by adding a
`pnpm-workspace.yaml` without a `packages` key, since that is what breaks
Vercel.

**Not acted on:**

- `**/_generated/**` in the shared ignore lists. Convex writes
  `convex/_generated/`, which `**/generated/**` does not match and
  `**/*.generated.*` does not either. Adding it would silently stop linting a
  directory in twelve repos to serve one, and that repo's own judgement was that
  the pattern is project-specific. It stays local.
- The `peerDependencyRules: ignoreMissing: [eslint]` stanza was reported as not
  achieving its stated purpose in a repo where `expo-module-scripts` pulls eslint
  in regardless. True, and it is still correct for the source it names — the
  README now says to check `pnpm why eslint` first rather than pasting it.
- Two repos reported pre-existing failures on their own `main` (40 typecheck
  errors from a Prisma enum, 42 jest suites failing at an ESM import through
  msw). Neither is downstream of anything magic ships.
- One report of `pnpm run lint` being rewritten into an `eslint` invocation by a
  local shell hook. Environment, not magic.

---

## 9. CI: composite actions, and tags instead of `@main`

Added 2026-07-27. The CI inventory across the eleven repos found the
`checkout → pnpm/action-setup → setup-node → pnpm install` quadruple **24 times
in 15 workflow files across 7 repos**, outside the reusable `ci.yml`, and it had
already drifted: three workflows hand-roll a `pnpm store path` + `actions/cache`
pair instead of `cache: pnpm`, three run `pnpm install` with no
`--frozen-lockfile` in a publish or deploy path, `actions/checkout` appears at
v3, v4, v5, v6, v7 and one SHA pin, and Node is pinned `22.x` in eight places in
a repo whose `.nvmrc` says `22.23`.

### What ships

Three composite actions, consumed as `GSTJ/magic/.github/actions/<name>@v1`:

- **`setup`** — pnpm, Node, the store cache, turbo's cache backend, and the
  install. Two of its defaults are deliberately not what `ci.yml` used to do.
- **`setup-ios-e2e`** — Xcode selection, a pinned and cached Maestro, CocoaPods,
  the pods/DerivedData caches, and a booted simulator, for the three repos that
  each implement all six of those differently.
- **`approve-parked-ci`** — react-native-magic-modal's version, verbatim in
  behaviour, with the git identity and the retry count as inputs. The portfolio
  repo's 42-line variant approves only the first parked run and exits 0 on
  failure; a repo with two `pull_request` workflows needs all of them released,
  and a green step on a PR nobody can merge is the failure it was written for.

### `registry-url` is empty by default now

`ci.yml` set `registry-url: "https://registry.npmjs.org"` on **every** caller,
including the nine that pass no `NPM_TOKEN`. That writes an `.npmrc` holding a
literal `${NODE_AUTH_TOKEN}`, which the package-manager probes behind `cache:`
choke on. One consumer had already documented the failure in a comment and
dropped the line locally. It is now derived —
`secrets.NPM_TOKEN != '' && 'https://registry.npmjs.org' || ''` — so the file is
written only when there is a token to put in it, and the composite warns when it
gets a `registry-url` with no token.

The pnpm store cache went the other way: on by default, because every hand-rolled
cache block in the fleet was a worse version of what `setup-node` already does.
The composite also falls back to the repo-root lockfile and then to no cache at
all, rather than failing the way `setup-node` does when
`<working-directory>/pnpm-lock.yaml` does not exist.

### A local action path does not work in a reusable workflow

`uses: ./.github/actions/setup` inside a `workflow_call` file resolves against
the **caller's** checkout, not this repo's, so it looks for the action in the
consumer's repository and fails there. Reusable workflows must write
`GSTJ/magic/.github/actions/setup@v1` in full. `self-ci.yml` and
`self-release.yml` are the only files here that may use `./`, because they only
ever run in this repo. `scripts/validate-workflows.mjs` fails the build on the
mistake, since it cannot be caught by testing in this repo.

### Versioning

Consumers reference tags. `@v1` moves on every release; `@v1.3.0` pins and lets
Renovate open the bump PR. `@main` is gone from the docs and from every
reference here, and the validator rejects it.

`self-release.yml` runs on push to `main`: full check chain, then
`pnpm -r publish` (which skips any package whose version is already on the
registry, so package versions stay hand-bumped in the commit that changes the
package), then `vX.Y.Z` derived from the conventional commits since the last tag,
then `v1` force-moved onto it. With no `v*` tag at all the base is the highest
version in `packages/*`, so the first automated release lands at 1.3.0 rather
than 0.0.1. This supersedes "Release automation for these packages isn't wired"
in §4.

Two things it does not do, on purpose:

- **No provenance.** pnpm 11.17.0 has no `--provenance` flag (verified against
  `pnpm publish --help`), and `npm publish` would ship the literal `workspace:*`
  devDependency specs that pnpm rewrites. Publishing correctly beats publishing
  with an attestation.
- **No cross-repo dispatch.** Propagation is Renovate-first: repos on `@v1` need
  no PR at all, and repos that pin exact get one grouped, automerged PR from the
  preset's new `GSTJ/magic` rule, which also drops the 3-day quarantine (it
  exists because pnpm 11 enforces a release-age floor on lockfiles, which has
  nothing to do with a workflow ref). A `repository_dispatch` fan-out would need
  a PAT with write access to eleven repos and a receiving workflow in each, to
  do what Renovate already does.

---

## 10. `magic/no-manual-classname`

Added 2026-07-27, from a directive naming the anti-pattern directly: manual
`className` composition is banned in the Tailwind/React repos. String
concatenation, template literals with expressions, ternaries inside the
attribute, and the side-class `Record` map whose values carry leading spaces.
Composition goes through `cn()` (clsx + tailwind-merge); a real variant axis
goes through `cva` or `tv`.

### Disposition, under governing directive #2

Tailwind and NativeWind are a stack choice: six of the thirteen repos surveyed
have no Tailwind dependency at all. So this is a stack-specific-but-good rule,
which under governing directive #2 means it ships enabled by nothing and
individually toggleable, like the other seven. No preset names it.
`fixtures/adversarial/optin` now asserts that twice over — once by running the
same tree through a config that loads the plugin and names no rule, and once by
reading all five emitted preset JSONs and failing if any of them contains a
`magic/` key at all.

### Semantics

The value of a `className` (or `class`) attribute must be a plain string, or a
call. Everything else is reported, under one of five message ids:

| Shape                                                       | messageId       |
| ----------------------------------------------------------- | --------------- |
| Template literal with expressions                           | `template`      |
| `+` concatenation                                           | `concatenation` |
| Ternary, or `&&`                                            | `conditional`   |
| Any of the above, assembled into a `const` first            | `indirect`      |
| A template literal reading from a `Record` of class strings | `classMap`      |

`classMap` names `cva`/`tv` ahead of `cn`, because a lookup table of class
strings is a variant axis, which is the thing `cva`/`tv` declare.

The rule inspects the shape of the attribute's value and nothing inside a call.
That one decision is what lets `cn("base", cond ? "a" : "b")` through, along
with any unknown helper, and it is why there is no `allowTernaryInCn` option:
arguments were never in scope.

### Evidence for the defaults

Counted across the thirteen repos before choosing anything, over
`*.ts,*.tsx,*.js,*.jsx,*.mjs` with `node_modules` excluded:

| Helper    | Call sites | Where                                                                  |
| --------- | ---------- | ---------------------------------------------------------------------- |
| `cn`      | 457        | chatmode 300, invest-radar 150, would-you-rather 5, e-card 1, pegada 1 |
| `cva`     | 20         | chatmode 12, invest-radar 4, would-you-rather 4                        |
| `twMerge` | 6          | all six `cn` definitions, and nowhere else                             |
| `clsx`    | 5          | five of the six `cn` definitions, and nowhere else                     |
| `cx`      | 1          | would-you-rather's `cn`, from `class-variance-authority`               |
| `tv`      | 0          | `tailwind-variants` is a dependency of nothing                         |

So the default `composers` list is `["cn", "cva", "twMerge", "clsx", "cx"]`, in
that order. `tv` is not in it, though it is still in the messages. The directive
names it as a variant builder and it is the right answer wherever it is
installed, but pointing the default diagnostics at a package no repo has would
be unfollowable advice. The list only decides which name the diagnostics use, so
leaving `tv` out of it costs nothing.

Four repos have a shadcn `components.json`, all four with `"aliases": { "utils":
"@/lib/utils" }`. Five of the six `cn` definitions in the tree are
`twMerge(clsx(inputs))` character for character; would-you-rather's is
`twMerge(cx(inputs))`, `cx` coming from CVA. Those six sit across five repos,
because invest-radar has one for its app and one for `surfaces/design`. And
e-card's is dead: it has the dependency, the `components.json` and the helper,
and zero importers.

Template-literal `className`s: gabriel-taveira-portfolio 21, chatmode 8,
invest-radar 1, padrinhos 1. The `Record`-with-leading-spaces shape exists
exactly once, in
`gabriel-taveira-portfolio/src/components/portfolio/marginalia.tsx`, which is
the file the rule was designed against. `+` concatenation into a `className`
never appears anywhere in the tree; that arm is prevention.

The portfolio composes classes constantly and has no `cn` at all: no `clsx`, no
`tailwind-merge`, no `components.json`. Its `ws-*` classes are a hand-written
CSS design system, so the conflict-merging half of the rationale does not apply
there. The falsy-piece and spacing half still does, and 21 of its 22 reports are
template literals.

`marginalia.tsx` shaped the implementation twice over. Its splice happens in a
`const className = ...` above the JSX, so a rule matching only `JSXAttribute`
values would miss the one file it was written for; hence the `const` following.
And a sibling component takes a `className` prop, which forced the rule to count
every binding form rather than only variable declarators. With declarators
alone, that prop resolved to the tainted `const` and produced a false positive
on the adversarial fixture. The rule now refuses to resolve any name it sees
bound twice in a file.

### Impact

Run over the repos themselves, rule alone, no preset:

| Repo                             | Reports |
| -------------------------------- | ------- |
| gabriel-taveira-portfolio        | 22      |
| chatmode                         | 11      |
| invest-radar                     | 6       |
| padrinhos-ana-julia-gabriel      | 1       |
| e-card, pegada, would-you-rather | 0       |

The three zeros already route every composition through `cn`.

### No autofix

`--fix` would have to wrap the expression in `cn()`, which produces the
byte-identical class string. The value of the change is splitting the expression
into arguments, so `clsx` drops the falsy ones and `tailwind-merge` resolves the
conflicts. Which piece becomes which argument is a judgement call, and getting
it wrong changes what renders without changing whether the rule passes. Same
reasoning as `prefer-suspense-query` and `prefer-early-return`.

### Known gaps

- `element.className = ...` outside JSX, which
  `invest-radar/sources/browser-ext/entrypoints/popup/main.ts:125` does with the
  same leading-space ternary. That package has no `cn`, and a DOM property
  assignment is a different rule.
- `let`, and any name bound twice in the file.
- Anything behind a function boundary: `className={buildClasses(side)}` may well
  be correct inside.
- `||` and `??`, which in an attribute are a default rather than a composition.
- A lookup table imported from another module. The generic `template` message
  fires instead of the `cva`/`tv` one; the advice is still right, just less
  specific.

### Naming

`no-manual-classname` describes what is banned. `prefer-cn` would have been
wrong, because `cn` is one of two right answers and a variant axis wants the
other. `no-classname-concat` covers `+` alone.

## 11. `magic-observability`

Added 2026-07-27. Every product repo needed PostHog wired up; only two had it,
and those two disagreed with each other. pegada ran a standalone `new PostHog()`
per runtime with `sendError` and an `analytics.track` shim; chatmode ran Sentry
for errors and PostHog for analytics, glued with `posthog.sentryIntegration`,
both no-oping outside production. The other five repos had nothing, and
would-you-rather had a `console.error` boundary that was never mounted plus
Bugsnag and Amplitude in `package.json` that nothing imported.

The package is pegada's shape, generalised, with chatmode's error normalisation
and typed-context discipline folded in. Sentry is not carried forward: PostHog's
error tracking is a self-driving signal source, and a split-brain where errors
live in one product and everything else in another is exactly the thing a
shared package should stop happening twice.

### One package, seven entry points, not seven packages

The obvious alternative was `magic-observability-web`, `-node`, `-expo`. One
package won because the interesting parts — `normalizeError`, `flattenContext`,
the facade, the boundary — are shared and would otherwise need a core package
that all three depend on, which is four packages to version instead of one.

The isolation the split packages would have given for free is bought back with
`scripts/validate-observability.mjs`. It walks the **built** module graph from
each entry point and asserts on the bare specifiers reachable from it:

```
.           → (no SDK)
./boundary  → react
./web       → posthog-js
./react     → @posthog/react, posthog-js, react
./next      → posthog-node
./node      → posthog-node
./expo      → posthog-react-native, react
```

`dist`, not `src`, because that is the difference that matters:
`import type { PostHogOptions } from "posthog-react-native"` is erased at build
and `import { PostHog }` is not, and it is the second one that would put a
browser SDK into a Hermes bundle. The check is in `pnpm run check` and in
self-CI, and it was verified to fail by adding one `import "posthog-js"` to
`dist/expo/index.js`.

Same reasoning as `validate-rules.mjs`: the failure is invisible here and
expensive there. A `/expo` that reaches `posthog-js` does not break this repo's
build, or its tests, or its types. It breaks a consumer's Metro bundle, weeks
later, and the person debugging it has no reason to look at this package.

### Why `/next` is server-only

Next is the one platform that is two platforms. `instrumentation-client.ts` is a
browser bundle and `instrumentation.ts` is Node, and a single `/next` entry
point serving both would put `posthog-node` in the browser chunk. So `/next`
means "the Next **server**", and the Next client uses `/web` and `/react` like
any other browser app. The README says so in the first table.

### No console output, anywhere

The requirement was that a product without a key must not crash _or spam
warnings in dev_. The strong version of that is easier to keep than the weak
one: this package writes to the console in no code path at all. `onDisabled`
and `onInternalError` are how you find out, and `test/no-op.test.mjs` asserts
silence by replacing all six console methods and demanding an empty log.

It also means there is no "debug mode" of our own. `debug: true` is forwarded to
the SDK, which has one.

### Error tracking on by default, in code

For the browser, PostHog treats exception autocapture as a _project setting_,
defaulting to remote config. `initWebAnalytics` sets `capture_exceptions: true`
anyway. The reasoning is the same one behind every other default in this repo: a
setting that has to be found in a UI, per project, is a setting that is missing
from most projects, and here "missing" means a product that reports nothing and
nobody notices. Passing `captureExceptions: false` opts back out.

Mobile console capture goes the other way — it is documented as
`console: ['error', 'warn']` and is defaulted here to `[]`. PostHog's own docs
say a `PostHogErrorBoundary` plus console capture double-reports every render
error, because React logs caught errors to the console itself. This package
ships a boundary and the README tells you to mount it, so the default is the
deduplicated one.

### Deviations from the research brief

- **`/web` rather than a Next client entry.** The brief listed `/next, /expo,
/node, /react`. A browser SPA (invest-radar's popup, e-card) needs
  `posthog-js` with no React provider at all, and Next's client half needs
  exactly the same thing, so the browser SDK got its own entry and `/react`
  became the bindings layer on top of it. `/boundary` split off for the same
  reason: it is React-only, and `/expo` needs it without `posthog-js`.
- **No wizard, no self-driving code.** Self-driving is a closed loop configured
  by `npx @posthog/wizard self-driving`, not an SDK feature; there is nothing to
  import. What it wants from an application — events flowing, error tracking on
  — is encoded as defaults. The rest is documented as manual.
- **`register` is not used on the server.** `posthog-node` has no super
  properties, being multi-tenant by design. `environment` and `release` are
  folded into the facade's default context instead, which reaches the same
  events by a different route.
- **Vite reads no environment variable.** `import.meta.env.VITE_*` is only
  substituted where it is written literally, and a library cannot write it on a
  consumer's behalf; `process.env` does not exist in a Vite browser bundle at
  all. Next and Expo _are_ read directly, because DefinePlugin and
  `babel-preset-expo` both substitute inside `node_modules`. The asymmetry is
  documented rather than papered over with a lookup that would silently resolve
  to `undefined`.

### Known gaps

- No `/vite` entry that reads `import.meta.env` for you. See above.
- Source maps are out of scope: `@posthog/nextjs-config` and `@posthog/cli` are
  build-time tools, and wrapping them would mean this package owning a build
  step. The READMEs carry the recipes.
- The boundary is tested by driving its lifecycle methods directly rather than
  through a renderer. `react-test-renderer` is gone in React 19 and a DOM shim
  for one `createElement` assertion is a lot of machinery; the logic under test
  is which client is called and which fallback is chosen, and React owns the
  rest.
- `/expo` cannot be imported in a Node test at all — `posthog-react-native`
  pulls in `react-native`. Its defaults are tested through `expo/options.ts`,
  which imports the SDK for types only and therefore compiles to a module with
  no runtime import. Same trick as `node/adapter.ts`.
