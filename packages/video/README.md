<p align="center">
  <img alt="Brand reel: magic-video's own window frame assembles and types out reel.tsx while magic-theme's palette flows in beside it, then the scene deals out into the closing contact sheet of every rendered still" src="https://assets.gabrieltaveira.dev/magic/magic-video-demo.gif" />
</p>

<p align="center">Compose a still from shared primitives and theme colors. Remotion renders it straight into media/.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-video"><img alt="npm version" src="https://shieldcn.dev/npm/magic-video.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## How it works

1. Each package owns the composition that draws its own media, in its `demo/media.tsx`, built
   from shared primitives (`magic-video/primitives`: windows, code panes, sparkles,
   backgrounds) and colors projected from `magic-theme`'s published palette
   (`magic-video/brand`). Packages pull those in as a devDependency; `demo/` stays out of every
   `files` whitelist, so nothing here reaches a published tarball. Only the repo-wide reels
   (`social`, `magic`) and this package's own still live in `src/compositions/`.
2. `root.tsx` imports each package's `demo/media.tsx` and registers every composition; render
   scripts point at its ids.
3. Remotion renders each one into `media/` at the repo root, gitignored scratch for local
   preview.
4. On merge to `main`, CI re-renders everything and publishes to the CDN the READMEs point at,
   so a palette or primitive change updates every image and video without anyone remembering to.

<p align="center">
  <img alt="A contact sheet of the stills magic-video renders into media/, one tinted card per package" src="https://assets.gabrieltaveira.dev/magic/magic-video.png" />
</p>

## Install

```sh
pnpm add -D magic-video
```

Import `magic-video/primitives` and `magic-video/brand` to build a demo video for your own repo
with the same windows, code panes, and theme-derived colors this one uses.

## Rendering this repo's media

```sh
pnpm --filter magic-video dev               # Remotion Studio
pnpm --filter magic-video render:all        # every asset into media/
pnpm --filter magic-video render:video-demo # this package's own reel, to out/intermediate.mp4
```

Each composition also has its own `render:<name>` script; see `package.json`.

## CI rendering

Every push to `main` that touches `packages/video/**`, any package's `demo/` composition, or
`packages/theme`'s palette (`vscode/themes/**`, `lib/**`) triggers `media.yml`, which reruns this
same render and publishes the result to the CDN. Docs-only edits are excluded. See the
[workflows adoption guide](../../.github/workflows/README.md#media) for what "publish" means and
what it doesn't touch here.
