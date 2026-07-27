# magic-oxlint-config

Shared oxlint presets. Five variants, each building on the last:

```
base ─┬─ react ─┬─ react-native ── expo
      │         └─ next
```

| Variant        | Import                             | For                           |
| -------------- | ---------------------------------- | ----------------------------- |
| `base`         | `magic-oxlint-config/base`         | Any TypeScript. No framework. |
| `react`        | `magic-oxlint-config/react`        | React web, no framework       |
| `react-native` | `magic-oxlint-config/react-native` | Bare React Native             |
| `next`         | `magic-oxlint-config/next`         | Next.js                       |
| `expo`         | `magic-oxlint-config/expo`         | Expo                          |

## Install

```sh
pnpm add -D oxlint@1.75.0 magic-oxlint-config
```

## Use

```ts
// oxlint.config.mts
import react from "magic-oxlint-config/react";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [react],
  // Required. oxlint does not inherit `ignorePatterns` through `extends` —
  // see "ignorePatterns do not travel through extends" below.
  ignorePatterns: react.ignorePatterns,
});
```

### JSON consumers

Every variant also ships as plain JSON, generated from the same source at build
time so it can't drift. `extends` in `.oxlintrc.json` is a **file path**, not a
package specifier, so it has to be spelled out — and the ignore patterns have to
be repeated, for the same reason as above:

```jsonc
// .oxlintrc.json
{
  "extends": ["./node_modules/magic-oxlint-config/react.json"],
  "ignorePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/.next/**",
    "**/.expo/**",
    "**/generated/**",
    "**/*.d.ts",
    "**/*.min.js",
  ],
}
```

The rest works — including the bare `jsPlugins` specifiers, because oxlint
resolves them relative to the config file, which in this case lives inside this
package next to its own `node_modules`. Verified against a real pnpm install of
the packed tarball.

Still prefer `oxlint.config.mts`: the JSON path hardcodes a `node_modules`
layout, and there the ignore list is a copy that goes stale instead of
`react.ignorePatterns`.

## What's in it

**Category strategy.** `correctness`, `suspicious`, `pedantic`, `style` and
`perf` are all `error`; `restriction` and `nursery` are off. Then roughly forty
individual rules are turned back off where the blanket switch is wrong more
often than it's right. This is the strategy already running in invest-radar and
in the MM mobile repo.

**Type-aware rules are included but dormant.** oxlint ignores them unless it's
run with `--type-aware`, silently and without error, so they cost nothing until
a repo is ready. See the root README for the switch-on checklist.

**JS plugins.** `react` and below wire in `eslint-plugin-safe-jsx`
(`safe-jsx/jsx-explicit-boolean`), which catches `items.length && <Row/>`
rendering a literal `0`. The React Native variants add
`eslint-plugin-react-native` for `no-inline-styles` and `no-color-literals`.
Both are dependencies of this package and are resolved from here, so pnpm's
non-hoisted layout doesn't break them.

**What's deliberately not in it.** Per-repo conventions — component wrappers,
service boundaries, ORM access patterns. Those go in each repo's own config.
See "Local overrides" in the root README.

## Notable behaviour

- `process.env` is banned via `no-restricted-properties`. `**/env.ts`, config
  files, scripts and `bin/` are exempt.
- Function declarations are banned via `func-style: expression`, replacing
  `eslint-plugin-prefer-arrow-functions`. Named exports are exempt so
  `export function GET()` and `export default function Page()` still work.
- Test files get the jest plugin, relaxed type-aware rules, `no-console` off,
  and a ban on `jest.clearAllMocks()` (use `clearMocks` in the jest config).
- Import _order_ is not enforced here — oxlint has no `import/order`. `oxfmt`
  owns it. See `magic-oxfmt-config`.
- Namespace imports are banned (`import/no-namespace`, the
  `@shopify/no-namespace-imports` replacement). `react` and below allow
  `import * as React from "react"` and `@radix-ui/*`; test files allow all of
  them, because that is how you spy on a module.

### `ignorePatterns` do not travel through `extends`

oxlint drops an extended config's `ignorePatterns`. Only the patterns written at
the top level of the config oxlint actually loaded apply. That holds for both
consumption paths — `defineConfig({ extends: [expo] })` and `.oxlintrc.json`
with `"extends": ["./node_modules/…/expo.json"]`.

Verified on 1.75.0: with `extends` alone and no `.gitignore`, an Expo app
reported half a million diagnostics out of `node_modules`, and seeded files
under `generated/`, `ios/` and `android/` were linted. Adding
`ignorePatterns: expo.ignorePatterns` took the same run to one diagnostic, in
`app/`.

`.gitignore` is honoured separately, which is what hides the `node_modules` case
in a real repo. It does not cover `ios/` and `android/` in bare React Native
repos, which commit them. Hoist the patterns.

## Development

`base.json` and friends are generated. Edit `src/*.ts` and run `pnpm build`.
`pnpm test` asserts the JSON mirrors match the JS and that oxlint accepts every
variant.
