#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
const extId = `gstj.magic-theme-${pkg.version}`;

const home = homedir();

/** @typedef {"cursor" | "vscode" | "warp" | "ghostty" | "alacritty" | "orca"} Target */

const ALL = /** @type {Target[]} */ ([
  "cursor",
  "vscode",
  "warp",
  "ghostty",
  "alacritty",
  "orca",
]);

function usage() {
  console.log(`magic-theme ${pkg.version}

Install Dracula 141414 for editors and terminals.

Usage:
  magic-theme install [targets...]
  magic-theme uninstall [targets...]
  magic-theme path [target]

Targets (default: all that look installed):
  cursor      ~/.cursor/extensions/${extId}
  vscode     ~/.vscode/extensions/${extId}
  warp       ~/.warp/themes/dracula-141414.yaml
  ghostty    ~/.config/ghostty/themes/dracula-141414
  alacritty  ~/.config/alacritty/themes/dracula-141414.toml
  orca       ~/.config/orca/themes/dracula-141414.yaml

Examples:
  magic-theme install
  magic-theme install cursor warp
  magic-theme uninstall cursor
`);
}

/** @param {Target} target */
function paths(target) {
  switch (target) {
    case "cursor":
      return {
        dest: join(home, ".cursor", "extensions", extId),
        src: join(pkgRoot, "vscode"),
        kind: "dir",
      };
    case "vscode":
      return {
        dest: join(home, ".vscode", "extensions", extId),
        src: join(pkgRoot, "vscode"),
        kind: "dir",
      };
    case "warp":
      return {
        dest: join(home, ".warp", "themes", "dracula-141414.yaml"),
        src: join(pkgRoot, "terminals", "warp.yaml"),
        kind: "file",
      };
    case "ghostty":
      return {
        dest: join(home, ".config", "ghostty", "themes", "dracula-141414"),
        src: join(pkgRoot, "terminals", "ghostty"),
        kind: "file",
      };
    case "alacritty":
      return {
        dest: join(
          home,
          ".config",
          "alacritty",
          "themes",
          "dracula-141414.toml",
        ),
        src: join(pkgRoot, "terminals", "alacritty.toml"),
        kind: "file",
      };
    case "orca":
      return {
        dest: join(home, ".config", "orca", "themes", "dracula-141414.yaml"),
        src: join(pkgRoot, "terminals", "warp.yaml"),
        kind: "file",
      };
    default:
      throw new Error(`unknown target: ${target}`);
  }
}

/** @param {Target} target */
function looksInstalled(target) {
  switch (target) {
    case "cursor":
      return existsSync(join(home, ".cursor"));
    case "vscode":
      return existsSync(join(home, ".vscode"));
    case "warp":
      return existsSync(join(home, ".warp")) || existsSync("/Applications/Warp.app");
    case "ghostty":
      return (
        existsSync(join(home, ".config", "ghostty")) ||
        existsSync("/Applications/Ghostty.app")
      );
    case "alacritty":
      return existsSync(join(home, ".config", "alacritty"));
    case "orca":
      return existsSync(join(home, ".config", "orca"));
    default:
      return false;
  }
}

/** @param {string} dest */
function ensureParent(dest) {
  mkdirSync(dirname(dest), { recursive: true });
}

/** @param {Target} target */
function installOne(target) {
  const { dest, src, kind } = paths(target);
  ensureParent(dest);
  rmSync(dest, { recursive: true, force: true });
  if (kind === "dir") {
    try {
      symlinkSync(src, dest, "dir");
    } catch {
      cpSync(src, dest, { recursive: true });
    }
  } else {
    try {
      symlinkSync(src, dest);
    } catch {
      cpSync(src, dest);
    }
  }
  console.log(`installed ${target} -> ${dest}`);
}

/** @param {Target} target */
function uninstallOne(target) {
  const { dest } = paths(target);
  if (!existsSync(dest)) {
    console.log(`skip ${target} (not installed)`);
    return;
  }
  rmSync(dest, { recursive: true, force: true });
  console.log(`removed ${dest}`);
}

/** @param {string[]} args */
function parseTargets(args) {
  if (args.length === 0) {
    return ALL.filter(looksInstalled);
  }
  /** @type {Target[]} */
  const out = [];
  for (const a of args) {
    if (!ALL.includes(/** @type {Target} */ (a))) {
      throw new Error(`unknown target: ${a}`);
    }
    out.push(/** @type {Target} */ (a));
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);

try {
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    usage();
    process.exit(0);
  }

  if (cmd === "path") {
    const target = /** @type {Target} */ (rest[0] ?? "cursor");
    console.log(paths(target).dest);
    process.exit(0);
  }

  if (cmd === "install") {
    const targets = parseTargets(rest);
    if (targets.length === 0) {
      console.error("nothing to install (pass targets explicitly)");
      process.exit(1);
    }
    for (const t of targets) installOne(t);
    console.log("");
    console.log("Cursor / VS Code: set color theme to \"Dracula 141414\" (reload if needed).");
    console.log("Warp: Settings -> Appearance -> Themes -> Dracula 141414.");
    console.log("Ghostty: theme = dracula-141414");
    console.log("Alacritty: import = [\"~/.config/alacritty/themes/dracula-141414.toml\"]");
    process.exit(0);
  }

  if (cmd === "uninstall") {
    const targets = parseTargets(rest.length ? rest : ALL);
    for (const t of targets) uninstallOne(t);
    process.exit(0);
  }

  console.error(`unknown command: ${cmd}`);
  usage();
  process.exit(1);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
