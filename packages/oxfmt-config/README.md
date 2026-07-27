# magic-oxfmt-config

Shared oxfmt configuration. Replaces both `prettier` and
`@ianvs/prettier-plugin-sort-imports`.

## Install

```sh
pnpm add -D oxfmt@0.60.0 magic-oxfmt-config
```

## Use

oxfmt has **no `extends`** — the key isn't in its schema, and writing one is
silently ignored rather than reported. Sharing therefore happens in JavaScript:
oxfmt executes `.ts`/`.mts` config files, so a real package import works.

```ts
// oxfmt.config.mts
import base from "magic-oxfmt-config";

export default base;
```

Variants add ignore patterns for framework and native directories:

```ts
import { expo } from "magic-oxfmt-config"; // also: react, reactNative, next

export default expo;
```

Extending locally:

```ts
import base from "magic-oxfmt-config";

export default {
  ...base,
  ignorePatterns: [...(base.ignorePatterns ?? []), "vendor/**"],
};
```

### If you can't run a TS config

```sh
pnpm exec magic-oxfmt-init expo      # writes .oxfmtrc.json
pnpm exec magic-oxfmt-init --help
```

This writes a **snapshot**. Bumping `magic-oxfmt-config` won't update it — rerun
the command. The `.mts` path is strictly better; use this only if the toolchain
forces plain JSON.

## House style

Prettier's defaults, which is what the incumbent `@magic/prettier-config` used
(it set no formatting overrides at all), so existing repos already look like this.

| Option           | Value      | Note                                       |
| ---------------- | ---------- | ------------------------------------------ |
| `printWidth`     | `80`       | oxfmt defaults to **100** — set explicitly |
| `singleQuote`    | `false`    | double quotes                              |
| `semi`           | `true`     |                                            |
| `trailingComma`  | `"all"`    |                                            |
| `arrowParens`    | `"always"` |                                            |
| `tabWidth`       | `2`        |                                            |
| `bracketSpacing` | `true`     |                                            |
| `endOfLine`      | `"lf"`     | oxfmt has no `"auto"`                      |

The MM mobile reference repo uses 120 columns and single quotes. We went with the
incumbent instead, so migrating repos don't get a whole-tree reflow on top of
everything else changing.

## Import order

Ported from the `importOrder` the prettier config used. oxfmt's sorter is a port
of `eslint-plugin-perfectionist`, so groups match by **glob**, not regex.

1. Type imports
2. Type imports from react / react-native, then next, then expo
3. Node builtins
4. react / react-native / react-dom
5. next
6. expo
7. Other third-party
8. Workspace-internal (`~/`, `@/`, `#`)
9. Parent, sibling, index relatives
10. Stylesheets

Two behaviours worth knowing:

- **Custom groups outrank predefined ones and are first-match-wins.** A bare
  `react` group would swallow `import type { ReactNode } from "react"` out of the
  type group, which is why the `-type` variants are listed first.
- **Side-effect imports don't move.** `sortSideEffects: false`, because the
  position of `import "react-native-gesture-handler"` _is_ its meaning.

`sortPackageJson` is on (scripts keep their authored order), so the first run
reorders keys in every `package.json`. Harmless, but expect the diff.

## Gotchas

- There is no `.oxfmtignore`. oxfmt honours `.gitignore`, `.prettierignore`, and
  the config's `ignorePatterns`.
- Put a blank line between a file-level doc comment and the first `import`.
  Otherwise the comment is treated as that import's leading comment and gets
  carried down the file when the imports sort.
- Unknown config keys are accepted without warning, so a typo fails open.

## Development

```sh
pnpm build && pnpm test
```

Tests run the real oxfmt binary and assert on the formatted output, including the
import order and the 80-column wrap.
