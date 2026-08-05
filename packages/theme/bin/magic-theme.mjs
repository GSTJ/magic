#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  cpSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toAlacritty, toGhostty, toWarp } from "../lib/formats.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const theme = JSON.parse(
  readFileSync(join(root, "vscode", "themes", "dracula-141414-color-theme.json"), "utf8"),
);
const extId = `gstj.magic-theme-${pkg.version}`;
const home = homedir();
const slug = "dracula-141414";

/** @typedef {"cursor" | "vscode" | "warp" | "ghostty" | "alacritty" | "orca"} Target */

const ALL = /** @type {Target[]} */ ([
  "cursor",
  "vscode",
  "warp",
  "ghostty",
  "alacritty",
  "orca",
]);

/** @type {Record<Target, { dest: string, detect: () => boolean, write: () => void, note?: string }>} */
const targets = {
  cursor: {
    dest: join(home, ".cursor", "extensions", extId),
    detect: () => existsSync(join(home, ".cursor")),
    write: () => linkOrCopyDir(join(root, "vscode"), join(home, ".cursor", "extensions", extId)),
    note: 'Color theme picker -> "Dracula 141414"',
  },
  vscode: {
    dest: join(home, ".vscode", "extensions", extId),
    detect: () => existsSync(join(home, ".vscode")),
    write: () => linkOrCopyDir(join(root, "vscode"), join(home, ".vscode", "extensions", extId)),
    note: 'Color theme picker -> "Dracula 141414"',
  },
  warp: {
    dest: join(home, ".warp", "themes", `${slug}.yaml`),
    detect: () => existsSync(join(home, ".warp")) || existsSync("/Applications/Warp.app"),
    write: () => write(join(home, ".warp", "themes", `${slug}.yaml`), toWarp(theme)),
    note: "Warp Themes -> Dracula 141414",
  },
  ghostty: {
    dest: join(home, ".config", "ghostty", "themes", slug),
    detect: () =>
      existsSync(join(home, ".config", "ghostty")) || existsSync("/Applications/Ghostty.app"),
    write: () => write(join(home, ".config", "ghostty", "themes", slug), toGhostty(theme)),
    note: "theme = dracula-141414",
  },
  alacritty: {
    dest: join(home, ".config", "alacritty", "themes", `${slug}.toml`),
    detect: () => existsSync(join(home, ".config", "alacritty")),
    write: () =>
      write(join(home, ".config", "alacritty", "themes", `${slug}.toml`), toAlacritty(theme)),
    note: `import = ["~/.config/alacritty/themes/${slug}.toml"]`,
  },
  orca: {
    dest: join(home, ".config", "orca", "themes", `${slug}.yaml`),
    detect: () => existsSync(join(home, ".config", "orca")),
    write: () => write(join(home, ".config", "orca", "themes", `${slug}.yaml`), toWarp(theme)),
  },
};

function usage() {
  console.log(`magic-theme ${pkg.version}

Install Dracula 141414 from the VS Code theme into editors and terminals.

Usage:
  magic-theme install [targets...]
  magic-theme uninstall [targets...]
  magic-theme path <target>

Targets: ${ALL.join(", ")}
`);
}

/** @param {string} dest @param {string} body */
function write(dest, body) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}

/** @param {string} src @param {string} dest */
function linkOrCopyDir(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  try {
    symlinkSync(src, dest, "dir");
  } catch {
    cpSync(src, dest, { recursive: true });
  }
}

/** @param {string[]} args */
function parseTargets(args) {
  if (args.length === 0) return ALL.filter((t) => targets[t].detect());
  return args.map((a) => {
    if (!(a in targets)) throw new Error(`unknown target: ${a}`);
    return /** @type {Target} */ (a);
  });
}

const [cmd, ...rest] = process.argv.slice(2);

try {
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    usage();
    process.exit(0);
  }
  if (cmd === "path") {
    const t = /** @type {Target} */ (rest[0] ?? "cursor");
    console.log(targets[t].dest);
    process.exit(0);
  }
  if (cmd === "install") {
    const list = parseTargets(rest);
    if (!list.length) {
      console.error("nothing to install (pass targets explicitly)");
      process.exit(1);
    }
    for (const t of list) {
      targets[t].write();
      console.log(`installed ${t} -> ${targets[t].dest}`);
      if (targets[t].note) console.log(`  ${targets[t].note}`);
    }
    process.exit(0);
  }
  if (cmd === "uninstall") {
    for (const t of parseTargets(rest.length ? rest : ALL)) {
      if (!existsSync(targets[t].dest)) {
        console.log(`skip ${t}`);
        continue;
      }
      rmSync(targets[t].dest, { recursive: true, force: true });
      console.log(`removed ${targets[t].dest}`);
    }
    process.exit(0);
  }
  console.error(`unknown command: ${cmd}`);
  usage();
  process.exit(1);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
