<p align="center">
  <img alt="Magic Theme coloring an editor window and a terminal window side by side" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-theme.png" />
</p>

<p align="center">Edit one theme JSON. Run install to match it across your editor and every terminal you use.</p>

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/magic-theme"><img alt="npm version" src="https://shieldcn.dev/npm/magic-theme.svg?variant=branded&size=xs&mode=light" /></a>
</p>

## Install

```sh
pnpm add -D magic-theme
pnpm exec magic-theme install
```

With no arguments, `install` writes every target it detects on the machine. Pass names to limit it:

```sh
pnpm exec magic-theme install cursor warp
```

Remove everything it wrote, or print where a target's file lands:

```sh
pnpm exec magic-theme uninstall
pnpm exec magic-theme path ghostty
```

## Palette

<p align="center">
  <img alt="Magic Theme palette strip: bg, fg, accent, success, error, warning, and the 16 ANSI colors" src="https://raw.githubusercontent.com/GSTJ/magic/main/media/magic-theme-palette.png" />
</p>

## Targets

`cursor`, `vscode`, `warp`, `ghostty`, `alacritty`, `orca`.

- Cursor and VS Code get the theme as an extension; pick "Magic Theme" in the color theme picker.
- Warp and Orca get a theme file; pick it in their Themes UI.
- Ghostty gets a theme file; set `theme = magic-theme` in its config.
- Alacritty gets a generated toml; add
  `import = ["~/.config/alacritty/themes/magic-theme.toml"]` to `alacritty.toml`.

Edit the VS Code theme JSON, re-run `install`, and every target follows. For projection into
more apps than these six, see [monotheme](https://github.com/eduwass/monotheme).
