# magic-theme

Dracula 141414 for editors and terminals. Install projects the VS Code theme JSON
into each tool.

## Install

```sh
pnpm --filter magic-theme exec magic-theme install
```

Or after publish:

```sh
npx magic-theme install
```

Default targets: apps we already have (`cursor`, `vscode`, `warp`, `ghostty`,
`alacritty`, `orca`). Pass names to limit:

```sh
magic-theme install cursor warp
```

## Layout

| Path | Role |
| ---- | ---- |
| `vscode/themes/dracula-141414-color-theme.json` | colors + syntax |
| `lib/project.mjs` | bg / fg / ANSI roles from that theme |
| `lib/formats.mjs` | Warp, Ghostty, Alacritty |
| `bin/magic-theme.mjs` | write into each app's config dir |

Edit the VS Code theme, re-run install.

## Elsewhere

| App | After install |
| --- | ------------- |
| Cursor / VS Code | theme **Dracula 141414** |
| Warp / Orca | Themes UI |
| Ghostty | `theme = dracula-141414` |
| Alacritty | import the generated toml |
| Windows Terminal | `toWindowsTerminal()` in `lib/formats.mjs` |

Broader multi-app projection from a VS Code theme:
[monotheme](https://github.com/eduwass/monotheme).
