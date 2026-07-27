# magic-tsconfig

Shared TypeScript config bases. Four variants, all strict, all `moduleResolution: Bundler`.

| File                    | Use for                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `base.json`             | plain TypeScript, apps, anything without a framework preset               |
| `internal-package.json` | workspace/publishable libraries that emit `.d.ts` (`emitDeclarationOnly`) |
| `nextjs.json`           | Next.js apps (`jsx: preserve`, DOM libs, the `next` TS plugin)            |
| `expo.json`             | Expo / React Native apps (`jsx: react-jsx`, excludes `ios`/`android`)     |

## Install

```sh
pnpm add -D magic-tsconfig
```

## Use

```jsonc
// tsconfig.json — plain TS
{ "extends": "magic-tsconfig/base.json" }
```

```jsonc
// tsconfig.json — publishable library
{
  "extends": "magic-tsconfig/internal-package.json",
  "include": ["src"],
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
}
```

```jsonc
// tsconfig.json — Next.js
{
  "extends": "magic-tsconfig/nextjs.json",
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },
}
```

```jsonc
// tsconfig.json — Expo. Expo's own base must come first so ours wins on conflicts.
{
  "extends": ["expo/tsconfig.base", "magic-tsconfig/expo.json"],
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
}
```

## Notes

- `checkJs` is on. If a project has untyped `.js` it can't fix yet, set
  `"checkJs": false` locally rather than dropping the base.
- `noUncheckedIndexedAccess` is on. It's the single most annoying and most
  valuable option here; don't turn it off, add the guard.
- `module: Preserve` + `moduleResolution: Bundler` means the bundler (Metro,
  Turbopack, tsdown) resolves modules, not tsc. For a package published to npm
  that consumers resolve with Node, override `module`/`moduleResolution` in the
  package's own tsconfig.

### `incremental`

`base.json`, `internal-package.json` and `expo.json` do not set it. A base that
publishable packages extend has no business carrying build-cache state: with
`incremental` on and no `tsBuildInfoFile`, tsc writes `<config>.tsbuildinfo`
_next to the config_, outside `outDir`, and a `rm -rf dist && tsc` then emits
nothing at all — exit 0, no output, no error.

**`nextjs.json` does set it, and has to.** `next build` writes any of its
suggested compiler options that are missing from the resolved config directly
into your `tsconfig.json`, and reformats the whole file while it is there.
`incremental` is the only suggested option this package would otherwise leave
unset, so without it every `next build` leaves a dirty tree and the next
`oxfmt --check` fails on a file nobody edited. It is safe there because
`nextjs.json` is `noEmit` — there is no output for a stale build info to
suppress — and because Next keeps its own build info in `.next/cache`.

Two consequences for Next repos:

- Keep `*.tsbuildinfo` in `.gitignore`. Your own `tsc --noEmit` writes
  `tsconfig.tsbuildinfo` beside your tsconfig.
- `tsBuildInfoFile` cannot be shipped here to move it: relative paths in an
  extended config resolve against the file that declares them, so an entry in
  this package would write inside `node_modules/magic-tsconfig`. Set it locally
  if you want it somewhere specific.

If you opt `incremental` on anywhere else, scope the cache in the same tsconfig:
`"tsBuildInfoFile": "dist/.tsbuildinfo"`. And note the pairing is not optional
on TypeScript 5.x — a `tsBuildInfoFile` left behind without `incremental` is
`error TS5069`, a hard typecheck failure. (tsgo 7.0.2 accepts it; TypeScript
5.4.5 does not.)
