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

### oxlint `--type-aware` — usable, but gated on TypeScript 7

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

Constraints for whoever enables it: TypeScript >= 7, no `baseUrl` in tsconfig,
`pnpm -r build` before linting in a monorepo (it reads dependency `.d.ts`), and
don't leave `"include": ["**/*"]` in a root tsconfig.

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

### Versions

- pnpm `latest` = 11.17.0. Root pins `packageManager: pnpm@11.17.0`.
- TypeScript `latest` = **7.0.2** (not 6.x). The portfolio repo is already on it,
  and 7.0 is also the floor for type-aware linting, so 7.x is the target.
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
| `@shopify/no-namespace-imports`                 | `import/no-namespace`                            |
| jest, jsx-a11y, react, import, promise, unicorn | native namespaces                                |

### Replaced with a different mechanism

**`no-restricted-syntax` does not exist in oxlint.** It was used for two things
and both have real rules now:

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

| Rule                          | Origin                                                             |
| ----------------------------- | ------------------------------------------------------------------ |
| `magic/prefer-early-return`   | `@shopify/prefer-early-return`, `maximumStatements` option         |
| `magic/no-barrel-file`        | invest-radar's `scripts/no-barrel.sh`, now a real rule             |
| `magic/no-module-mocks`       | g2i `testing-policy/no-module-mocks`, generalised to jest + vitest |
| `magic/prefer-suspense-query` | g2i `prefer-suspense-query/no-use-query`, roots configurable       |

Per the governing directive, none of these is in any default preset. The last
two are stack-specific; the first two are policies a repo should choose.

### Dropped

| Rule                                            | Why                                                                                                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@shopify/jsx-no-hardcoded-content`             | Only pays off with i18n; `react/jsx-no-literals` is near-native if wanted                                                                                              |
| `@shopify/strict-component-boundaries`          | Fails under oxlint — `unable to load resolver "node"`                                                                                                                  |
| `@shopify/react-require-autocomplete`           | Web-form specific, narrow                                                                                                                                              |
| `@shopify/react-hooks-strict-return`            | Opinionated beyond its payoff                                                                                                                                          |
| `@shopify/no-ancestor-directory-import`         | Expressible with `no-restricted-imports` patterns                                                                                                                      |
| `@shopify/restrict-full-import`                 | Same                                                                                                                                                                   |
| `react/jsx-no-leaked-render`                    | `safe-jsx/jsx-explicit-boolean` covers the `&&` case, which is the leak that matters. **Removed from oxlint before 1.75** — it's in the MM config and no longer loads. |
| `testing-library/*`                             | Works as a jsPlugin unmodified, but shipping the dependency to every consumer isn't worth it. Add per repo.                                                            |
| `jest-formatting/*`                             | Pure formatting; oxfmt handles spacing                                                                                                                                 |
| `eslint-plugin-eslint-comments`                 | Superseded by `--report-unused-disable-directives`                                                                                                                     |
| `unicorn/no-array-push-push`, `no-octal-escape` | Both in the MM config, both gone from oxlint 1.75                                                                                                                      |
| `unicorn/filename-case`                         | See below — the repos disagree                                                                                                                                         |

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

---

## 3. Guard rails built

Two scripts exist because of things that went wrong while building this.

**`scripts/validate-rules.mjs`** — checks every rule name in every emitted
variant against oxlint's own shipped JSON schema. An unknown rule name is a
_fatal_ config error in oxlint, not a warning, so one stale name breaks every
consumer at once. Three rules in the MM reference config
(`react/jsx-no-leaked-render`, `unicorn/no-array-push-push`, `no-octal-escape`)
are already gone in 1.75. Run this after any oxlint bump.

**`scripts/smoke.mjs`** — lints `fixtures/smoke`, a deliberately broken file, and
asserts on exactly which rules fire. Guards against a config change quietly
ceasing to catch leaked `&&` JSX, `process.env` access, nested ternaries, unused
imports, and the two enabled plugin rules.

---

## 4. Known gaps and TODOs

- **`react/react-compiler` is a `nursery` rule.** It's the one nursery rule the
  `react` preset enables, to preserve the incumbent
  `react-compiler/react-compiler`. Nursery rules are explicitly unstable; if it
  misbehaves on a repo, turn it off locally rather than fighting it.

- **`.oxfmtrc.json` snapshots go stale.** `magic-oxfmt-init` writes a point-in-time
  copy. Repos on that path won't pick up config changes from a version bump.
  Prefer `oxfmt.config.mts`. A `--check` mode that diffs an existing snapshot
  against the current package would close this; not built.

- **No type-aware CI run anywhere yet.** The rules are configured and verified
  firing locally, but no repo in the migration set is switched on. invest-radar
  is closest (already runs `--type-aware` with its own config).

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

- **Release automation for these packages isn't wired.** `release.yml` exists as
  a reusable workflow, but this repo has no `.release-it.js` and no publish
  trigger of its own. Publishing is manual for now.

- **`magic-tsconfig` has no test.** The JSON is simple enough that a broken
  `extends` would surface immediately in any consumer, but there's no check here.
