# magic-theme

Dracula 141414 for editors, terminals, Claude Code, and Codex. Install projects
the VS Code theme JSON into each tool.

## Install

```sh
pnpm --filter magic-theme exec magic-theme install
```

Or after publish:

```sh
npx magic-theme install
```

Default targets: apps we already have (`cursor`, `vscode`, `warp`, `ghostty`,
`alacritty`, `orca`, `claude`, `codex`). Pass names to limit:

```sh
magic-theme install cursor claude codex warp
```

## Layout

| Path | Role |
| ---- | ---- |
| `vscode/themes/dracula-141414-color-theme.json` | colors + syntax |
| `lib/project.mjs` | bg / fg / ANSI roles from that theme |
| `lib/formats.mjs` | Warp, Ghostty, Alacritty, Claude, TextMate |
| `bin/magic-theme.mjs` | write into each app's config dir |

Edit the VS Code theme, re-run install.

## Claude Code

Install writes `~/.claude/themes/dracula-141414.json` and sets
`theme: "custom:dracula-141414"` in settings. Confirm in `/theme`.

## Codex

Install writes `~/.codex/themes/dracula-141414.tmTheme` and sets `[tui] theme`.
Confirm in `/theme`.

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
