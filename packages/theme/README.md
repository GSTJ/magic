# magic-theme

Dracula 141414 for Cursor / VS Code and terminals. `#141414` chrome, quieter
blues, slightly softened cyan/magenta ANSI.

Edit `palette.json` and rebuild editor and terminal files from it.

## Install

From this repo:

```sh
pnpm --filter magic-theme exec magic-theme install
```

Or after publish:

```sh
npx magic-theme install
```

Default targets: apps we already have on the machine (`cursor`, `vscode`, `warp`,
`ghostty`, `alacritty`, `orca`). Pass names to limit:

```sh
magic-theme install cursor warp
magic-theme uninstall cursor
```

## Editors

After install, pick **Dracula 141414** in the color theme picker. Reload the
window if it does not show up.

Extension path:

```text
~/.cursor/extensions/gstj.magic-theme-<version>
~/.vscode/extensions/gstj.magic-theme-<version>
```

## Terminals

| App        | File after install                                      | Enable |
| ---------- | ------------------------------------------------------- | ------ |
| Warp       | `~/.warp/themes/dracula-141414.yaml`                    | Themes UI |
| Ghostty    | `~/.config/ghostty/themes/dracula-141414`               | `theme = dracula-141414` |
| Alacritty  | `~/.config/alacritty/themes/dracula-141414.toml`        | `import` that file |
| Orca       | `~/.config/orca/themes/dracula-141414.yaml`             | Themes UI |
| Windows Terminal | `terminals/windows-terminal.json` (copy into settings) | Color schemes |

## Rebuild

When `palette.json` changes and the official Dracula VS Code extension is
installed locally:

```sh
pnpm --filter magic-theme run build
```

That rewrites the VS Code theme and terminal files. Syntax tokens still come
from Dracula (see `NOTICE`).
