import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** A refusal the CLI reports as a message, not a stack trace. */
export class CodemodError extends Error {
  override name = "CodemodError";
}

const git = (root: string, args: string[]): string =>
  execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

export const repoRoot = (from: string): string => {
  try {
    return git(from, ["rev-parse", "--show-toplevel"]).trim();
  } catch {
    throw new CodemodError(
      `Not inside a git repository: ${from}\n` +
        "magic-kebab renames through `git mv` so history survives, which needs a repo.",
    );
  }
};

/**
 * Refuse to run on a dirty tree.
 *
 * Not paranoia: this command rewrites import specifiers across every source
 * file and moves files on disk. If it gets something wrong, `git checkout .` has
 * to be a complete undo, and it only is when there was nothing else in the
 * working tree to begin with. Untracked files count — a `git mv` onto an
 * untracked path clobbers it silently.
 */
export const assertCleanTree = (root: string): void => {
  const status = git(root, ["status", "--porcelain", "--untracked-files=all"]);
  if (status.trim() === "") return;

  const lines = status.trim().split("\n");
  const shown = lines.slice(0, 20).join("\n");
  throw new CodemodError(
    `Working tree is not clean (${lines.length} entr${lines.length === 1 ? "y" : "ies"}).\n\n` +
      `${shown}${lines.length > 20 ? `\n… and ${lines.length - 20} more` : ""}\n\n` +
      "Commit or stash first. This codemod moves files and rewrites imports across the\n" +
      "repo; `git checkout .` is only a complete undo if the tree started clean.\n" +
      "Pass --allow-dirty to override, and keep the pieces.",
  );
};

export const trackedFiles = (root: string): string[] =>
  git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);

export const isTracked = (root: string, relativePath: string): boolean => {
  try {
    return (
      git(root, ["ls-files", "--error-unmatch", "--", relativePath]).trim() !==
      ""
    );
  } catch {
    return false;
  }
};

/**
 * Rename through a temporary name, always.
 *
 * macOS ships APFS case-insensitive by default, so `Button.tsx` and
 * `button.tsx` are the *same path*. `git mv Button.tsx button.tsx` there is
 * either refused as "destination exists" or, with `-f`, becomes a no-op that
 * still updates the index — you get a commit that claims a rename the working
 * tree never performed, and the next `git checkout` on a Linux CI box produces
 * a file nobody has locally. Every case-only rename in this repo family has to
 * go via a third name.
 *
 * Doing it unconditionally rather than only for case-only renames keeps one
 * code path, and it is invisible in history: git records no rename operation in
 * a commit at all, it infers renames from content similarity at diff time. Two
 * `git mv`s before one commit produce exactly one rename in that commit, which
 * is what makes `git log --follow` keep working.
 */
export const gitMoveViaTemp = (
  root: string,
  fromRelative: string,
  toRelative: string,
): void => {
  const directory = dirname(fromRelative);
  const temporary = join(
    directory === "." ? "" : directory,
    `.magic-kebab-tmp-${process.pid}-${Buffer.from(toRelative).toString("hex").slice(0, 12)}`,
  );

  if (existsSync(join(root, temporary))) {
    throw new CodemodError(
      `Temporary rename path already exists: ${temporary}. Remove it and re-run.`,
    );
  }

  git(root, ["mv", fromRelative, temporary]);
  try {
    git(root, ["mv", temporary, toRelative]);
  } catch (error) {
    // Put it back rather than leaving a `.magic-kebab-tmp-*` file behind.
    git(root, ["mv", temporary, fromRelative]);
    throw error;
  }
};
