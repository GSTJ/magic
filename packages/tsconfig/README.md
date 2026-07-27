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
