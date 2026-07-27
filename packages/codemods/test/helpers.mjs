import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const packageRoot = join(import.meta.dirname, "..");
export const repoRoot = join(packageRoot, "..", "..");
export const cliPath = join(packageRoot, "dist", "cli.js");
export const oxlintBin = join(repoRoot, "node_modules", ".bin", "oxlint");
export const tscBin = join(repoRoot, "node_modules", ".bin", "tsc");

export const run = (command, args, options = {}) => {
  try {
    return {
      status: 0,
      stdout: execFileSync(command, args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        ...options,
      }),
      stderr: "",
    };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error),
    };
  }
};

export const git = (cwd, ...args) => run("git", ["-C", cwd, ...args]);

export const makeTempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "magic-kebab-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "codemod@example.test");
  git(dir, "config", "user.name", "Codemod Test");
  git(dir, "config", "core.ignorecase", "true");
  return dir;
};

export const write = (root, relativePath, content) => {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
};

export const commitAll = (root, message) => {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
};

export const cleanup = (dir) => rmSync(dir, { recursive: true, force: true });

export const magicKebab = (root, ...args) =>
  run(process.execPath, [cliPath, "--root", root, ...args], { cwd: root });
