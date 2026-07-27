# magic-oxlint-plugin

Four oxlint rules with no built-in equivalent. **All opt-in** — nothing here is
enabled by any `magic-oxlint-config` preset. They're policies rather than bug
detectors, or they're stack-specific, and both kinds of rule should be a
deliberate choice per repo.

## Install

```sh
pnpm add -D magic-oxlint-plugin
```

```ts
// oxlint.config.mts
import base from "magic-oxlint-config/base";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  jsPlugins: [{ name: "magic", specifier: "magic-oxlint-plugin" }],
  rules: {
    "magic/prefer-early-return": ["error", { maximumStatements: 0 }],
  },
});
```

## Rules

### `magic/prefer-early-return`

Port of `@shopify/prefer-early-return`. Flags a function whose entire body is a
single `if` with no `else`.

```ts
// reported
const handle = (ok: boolean) => {
  if (ok) {
    doA();
    doB();
  }
};

// fine
const handle = (ok: boolean) => {
  if (!ok) return;
  doA();
  doB();
};
```

Options: `maximumStatements` (default `0`) — how many statements may sit inside
the lone `if` before it's reported.

Not auto-fixable. Inverting a condition correctly means understanding `&&`/`||`
precedence; a blind `!(...)` wrapper reads worse than the original.

### `magic/no-barrel-file`

Bans catch-all `export * from "..."` in package entry points. A wildcard
re-export pulls every transitive symbol into every consumer's module graph,
defeats subpath exports, and makes the public API unreadable. Named re-exports
are fine.

Generalised from invest-radar's `scripts/no-barrel.sh`, which was a separate CI
step that couldn't point at a line or be silenced per-case.

Options:

- `files` — path suffixes that count as entry points. Default:
  `["/src/index.ts", "/src/index.tsx", "/index.ts", "/index.tsx"]`
- `allow` — path substrings permitted to keep a barrel, for grandfathered
  facades.

```ts
"magic/no-barrel-file": ["error", { allow: ["foundation/core/src/index.ts"] }]
```

### `magic/no-module-mocks`

Bans `vi.mock()` / `jest.mock()` and friends in test files. Module mocks couple
a test to the module graph instead of to behaviour: they break on rename, hide
real integration failures, and let a test pass for reasons unrelated to the code
under test.

A distinct message fires when the call is inside a conditional, because mock
calls are hoisted and the conditional does not do what it looks like.

Options: `objects` (default `["vi", "jest"]`), `methods`, `testFilePattern`.

Generalised from the g2i `testing-policy/no-module-mocks` rule, which was
vitest-only. Not auto-fixable: removing the call leaves a test that imports the
real module and fails.

### `magic/prefer-suspense-query`

Steers tRPC / TanStack Query call sites from `useQuery` to `useSuspenseQuery`,
so loading and error states live in one `<Suspense>` / `<ErrorBoundary>` pair
instead of in every component as `isLoading` branches.

Walks the member chain back to its root identifier and only reports when that
root is configured, so an unrelated `something.useQuery()` is left alone.

Options: `roots` (default `["api", "trpc"]`), `hooks` (default `["useQuery"]`).

Not auto-fixable, deliberately. The return shape changes — `data` stops being
possibly-undefined, and surrounding `isLoading` / `isError` / `refetch` usage
has to be removed by hand. A rename alone produces code that doesn't compile.

## Rules considered and dropped

| ESLint rule                             | Why it isn't here                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@shopify/jsx-no-hardcoded-content`     | Only useful with an i18n setup; near-native `react/jsx-no-literals` exists                                                                       |
| `@shopify/strict-component-boundaries`  | Depends on `eslint-module-utils` resolvers, which fail under oxlint (`unable to load resolver "node"`)                                           |
| `@shopify/react-require-autocomplete`   | Web-form specific, narrow value                                                                                                                  |
| `@shopify/react-hooks-strict-return`    | Opinionated beyond its payoff                                                                                                                    |
| `@shopify/no-ancestor-directory-import` | Expressible with `no-restricted-imports` patterns                                                                                                |
| `@shopify/restrict-full-import`         | Same                                                                                                                                             |
| `@shopify/no-namespace-imports`         | Native `import/no-namespace` covers it                                                                                                           |
| `react/jsx-no-leaked-render`            | `safe-jsx/jsx-explicit-boolean` covers the `&&` case, which is the one that actually leaks. The oxlint rule existed before 1.75 and was removed. |
| `prefer-arrow-functions/*`              | Native `func-style: expression` gets the same outcome                                                                                            |
| `unused-imports/no-unused-imports`      | Native `no-unused-vars` already reports unused imports                                                                                           |
| `import/order`                          | Not a lint concern here — `oxfmt` sorts imports                                                                                                  |
| `testing-library/*`                     | `eslint-plugin-testing-library` works as a jsPlugin unmodified; add it per repo rather than shipping the dependency to everyone                  |

## Authoring notes

Rules use `oxlint`'s `defineRule` / `createOnce` fast path when it's available
and fall back to the classic ESLint `create()` API when it isn't — see
`src/rule-api.ts`. Under `createOnce` the visitor object is built once for the
whole run, so anything file-dependent (the filename, most obviously) has to be
read inside `before()`.

Tests run the real oxlint binary over temp files with the real plugin loaded, so
they exercise the actual integration rather than a mock context.

```sh
pnpm build && pnpm test
```
