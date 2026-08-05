# demo-video

Remotion source for every image and GIF committed at the repo root's `media/`: one hero still per
package README, the theme palette strip, the codemods demo GIF, and the repo social card. Nothing is
hand-screenshotted. Colors come from `magic-theme`'s published VS Code theme through its own
`project()`, fonts load from `public/fonts/` (Instrument Sans, Instrument Serif italic, JetBrains
Mono), and code panels are shiki-tokenized with the real theme JSON, so every asset stays on brand
by construction.

## Rendering

```bash
pnpm --filter @magic/demo-video dev                 # Remotion Studio
pnpm --filter @magic/demo-video render:all          # every asset into media/
pnpm --filter @magic/demo-video render:theme        # one still, same pattern per composition
pnpm --filter @magic/demo-video render:codemods-gif # the demo GIF (renders its own mp4 first)
pnpm --filter @magic/demo-video render:social       # the social card
```

Render locally in the PR that touches a composition. `media/` is the source of truth: the committed
files are what every README links, and nothing in CI regenerates them for you. The intermediate mp4
only exists during a GIF render and lands in the gitignored `out/`.

The GIF is a second ffmpeg pass over the rendered mp4 (two-pass palette, 960 wide, 12 fps, capped
at 15s) because Remotion cannot emit 12 fps from a 30 fps composition on its own. `-t 15` tracks
the composition length; change `durationInFrames` on `CodemodsDemo` and that flag has to follow.

## Layout

Each package owns `src/compositions/<pkg>.tsx` and nothing else. The shared pieces live one level
up: `brand.ts` (colors projected from the theme), `fonts.ts`, `primitives.tsx` (windows, code
panes, sparkles, backgrounds), and `shiki.ts` (async tokenizing bridged to Remotion with
`delayRender`). `root.tsx` registers every composition and is final; render scripts point at its
ids.

This package deliberately has no `build`, `lint`, or `test` script, so the root task graph stays
the size it was before it existed. `typecheck` is the one gate it adds.
