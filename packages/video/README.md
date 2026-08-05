<p align="center">
  <img alt="A contact sheet of the stills magic-video renders into media/, one tinted card per package" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-video.png" />
</p>

<p align="center">Compose a still from shared primitives and theme colors. Remotion renders it straight into media/.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-video"><img alt="npm version" src="https://shieldcn.dev/npm/magic-video.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## How it works

1. Each package owns one composition under `src/compositions/`, built from shared primitives
   (`primitives.tsx`: windows, code panes, sparkles, backgrounds) and colors projected from
   `magic-theme`'s published palette (`brand.ts`).
2. `root.tsx` registers every composition; render scripts point at its ids.
3. Remotion renders each one straight into `../../media/` at the repo root, the folder every
   README's hero image points at.
4. Render locally in the PR that changes a composition. Nothing in CI regenerates these files;
   whatever is committed in `media/` is what every README shows.

## Install

```sh
pnpm add -D magic-video
```

Import `magic-video/primitives` and `magic-video/brand` to build a demo video for your own repo
with the same windows, code panes, and theme-derived colors this one uses.

## Rendering this repo's media

```sh
pnpm --filter magic-video dev          # Remotion Studio
pnpm --filter magic-video render:all   # every asset into media/
```

Each composition also has its own `render:<name>` script; see `package.json`.
