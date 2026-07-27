import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";

import { CodemodError, trackedFiles } from "./git.ts";
import { isKebabCase, isLintable, kebabifyBasename } from "./kebab.ts";

export type DetectMode = "oxlint" | "builtin";

export interface Violation {
  /** Repo-relative path, POSIX separators. */
  readonly path: string;
  /** Target basename, not a path. */
  readonly target: string;
  readonly source: DetectMode;
}

const OXLINT_CODE = "unicorn(filename-case)";

/** `Rename the file to 'pascal-thing.ts'` → `pascal-thing.ts` */
const targetFromHelp = (help: unknown): string | undefined => {
  if (typeof help !== "string") return undefined;
  return /Rename the file to '(?<target>[^']+)'/u.exec(help)?.groups?.[
    "target"
  ];
};

const resolveOxlintBinary = (root: string): string => {
  const local = join(root, "node_modules", ".bin", "oxlint");
  if (existsSync(local)) return local;
  return "oxlint";
};

/**
 * Ask the repo's own oxlint what is wrong.
 *
 * Deliberately a *plain* run against the repo's real config rather than
 * something scoped like `-A all -D unicorn/filename-case`. Verified on 1.75.0:
 * `-D <rule>` re-enables the rule with its **default options**, discarding the
 * `ignore` list the config set — a run scoped that way reports every
 * `[postId].tsx` in the repo. `overrides` survive it, rule options do not. So
 * the fast path is the wrong path, and this pays the cost of a full lint to get
 * an answer that actually matches what CI will say.
 */
const detectWithOxlint = (root: string, paths: string[]): Violation[] => {
  const binary = resolveOxlintBinary(root);
  let stdout: string;
  try {
    stdout = execFileSync(binary, ["--format=json", ...paths], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // oxlint exits 1 whenever it reported anything, which is the normal case
    // here. Only a missing binary or an unparseable config is fatal.
    const failure = error as {
      stdout?: string;
      stderr?: string;
      code?: string;
    };
    if (failure.code === "ENOENT") {
      throw new CodemodError(
        "Could not run oxlint. Install it in the target repo (`pnpm add -D oxlint`)\n" +
          "or re-run with `--detect builtin` to use the bundled kebab-case check.",
      );
    }
    stdout = failure.stdout ?? "";
    if (stdout.trim() === "") {
      throw new CodemodError(
        `oxlint produced no JSON output. Its stderr was:\n${failure.stderr ?? "(empty)"}`,
      );
    }
  }

  let parsed: { diagnostics?: unknown[] };
  try {
    parsed = JSON.parse(stdout) as { diagnostics?: unknown[] };
  } catch {
    throw new CodemodError(
      `oxlint did not return JSON. First 400 characters:\n${stdout.slice(0, 400)}`,
    );
  }

  return (parsed.diagnostics ?? [])
    .map((raw) => raw as { code?: string; filename?: string; help?: string })
    .filter(
      (diagnostic) =>
        diagnostic.code === OXLINT_CODE &&
        typeof diagnostic.filename === "string",
    )
    .map((diagnostic) => {
      const path = String(diagnostic.filename)
        .replace(/^\.\//u, "")
        .replaceAll("\\", "/");
      return {
        path,
        target:
          targetFromHelp(diagnostic.help) ?? kebabifyBasename(basename(path)),
        source: "oxlint" as const,
      };
    });
};

/**
 * The offline path. Applies this package's own copy of the rule to every
 * tracked file. Cheaper and works before a repo has adopted the preset, at the
 * cost of not knowing about that repo's `ignore` list or `overrides`.
 */
const detectWithBuiltin = (root: string, paths: string[]): Violation[] => {
  const prefixes = paths
    .map((path) => path.replace(/^\.\/?/u, "").replace(/\/$/u, ""))
    .filter((path) => path !== "" && path !== ".");

  return trackedFiles(root)
    .filter((path) => {
      if (!isLintable(basename(path))) return false;
      if (prefixes.length === 0) return true;
      return prefixes.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      );
    })
    .filter((path) => !isKebabCase(basename(path)))
    .map((path) => ({
      path,
      target: kebabifyBasename(basename(path)),
      source: "builtin" as const,
    }));
};

export const detectViolations = (
  root: string,
  paths: string[],
  mode: DetectMode,
): Violation[] => {
  const found =
    mode === "oxlint"
      ? detectWithOxlint(root, paths.length > 0 ? paths : ["."])
      : detectWithBuiltin(root, paths);

  return [...found].sort((a, b) => (a.path < b.path ? -1 : 1));
};
