import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

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

type UnsafeSourcePath = {
  readonly path: string;
  readonly reason: string;
};

const isInside = (root: string, candidate: string): boolean => {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) &&
      fromRoot !== ".." &&
      !fromRoot.startsWith(`..${sep}`))
  );
};

const errorCode = (error: unknown): string | undefined =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : undefined;

const resolveRoot = (root: string): string => {
  try {
    return realpathSync(root);
  } catch (error) {
    throw new CodemodError(
      `Could not resolve repository root ${root}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const lstatTrackedComponent = (
  absolutePath: string,
  sourcePath: string,
): ReturnType<typeof lstatSync> | undefined => {
  try {
    return lstatSync(absolutePath);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw new CodemodError(
      `Could not inspect tracked source path ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

type ComponentInspection = UnsafeSourcePath | "missing" | undefined;

const inspectComponents = (
  root: string,
  sourcePath: string,
): ComponentInspection => {
  const components = sourcePath.split("/");
  let current = root;

  for (const [index, component] of components.entries()) {
    current = join(current, component);
    const entry = lstatTrackedComponent(current, sourcePath);
    if (entry === undefined) return "missing";

    const namedComponent = components.slice(0, index + 1).join("/");
    if (entry.isSymbolicLink()) {
      return { path: sourcePath, reason: `symbolic link at ${namedComponent}` };
    }
    if (index < components.length - 1 && !entry.isDirectory()) {
      return {
        path: sourcePath,
        reason: `${namedComponent} is not a directory`,
      };
    }
    if (index === components.length - 1 && !entry.isFile()) {
      return { path: sourcePath, reason: "not a regular file" };
    }
    if (index === components.length - 1 && entry.nlink !== 1) {
      return { path: sourcePath, reason: `has ${entry.nlink} hard links` };
    }
  }

  return undefined;
};

const resolveTrackedSource = (
  root: string,
  sourcePath: string,
): string | undefined => {
  try {
    return realpathSync(join(root, sourcePath));
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw new CodemodError(
      `Could not resolve tracked source path ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const inspectSourcePath = (
  root: string,
  canonicalRoot: string,
  sourcePath: string,
): UnsafeSourcePath | undefined => {
  const componentProblem = inspectComponents(root, sourcePath);
  if (componentProblem === "missing") return undefined;
  if (componentProblem !== undefined) return componentProblem;

  const canonicalSource = resolveTrackedSource(root, sourcePath);
  if (canonicalSource === undefined || isInside(canonicalRoot, canonicalSource))
    return undefined;
  return { path: sourcePath, reason: "resolves outside the repo" };
};

/** Refuse paths that cannot be read and written without leaving the repo. */
export const assertSafeTrackedSourcePaths = (
  root: string,
  sourcePaths: string[],
): void => {
  const canonicalRoot = resolveRoot(root);
  const unsafe = sourcePaths
    .map((sourcePath) => inspectSourcePath(root, canonicalRoot, sourcePath))
    .filter((entry): entry is UnsafeSourcePath => entry !== undefined);

  if (unsafe.length === 0) return;

  throw new CodemodError(
    `Refusing to inspect ${unsafe.length} unsafe tracked source path${unsafe.length === 1 ? "" : "s"}:\n` +
      `${unsafe.map((entry) => `  ${entry.path} (${entry.reason})`).join("\n")}\n\n` +
      "magic-kebab rewrites source files in place. Restore these paths as regular files inside the repo before running it.",
  );
};

const openTrackedSource = (
  root: string,
  relativePath: string,
  flags: number,
): number => {
  assertSafeTrackedSourcePaths(root, [relativePath]);

  const absolute = join(root, relativePath);
  let descriptor: number | undefined;
  try {
    // Filesystem open flags are a bit mask.
    // oxlint-disable-next-line no-bitwise
    descriptor = openSync(absolute, flags | constants.O_NOFOLLOW);
    assertSafeTrackedSourcePaths(root, [relativePath]);

    const opened = fstatSync(descriptor);
    const named = lstatSync(absolute);
    if (
      !opened.isFile() ||
      !named.isFile() ||
      opened.dev !== named.dev ||
      opened.ino !== named.ino ||
      opened.nlink !== 1
    ) {
      throw new CodemodError(
        `Tracked source path changed while magic-kebab was running: ${relativePath}`,
      );
    }

    return descriptor;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error instanceof CodemodError) throw error;
    throw new CodemodError(
      `Could not open tracked source path safely: ${relativePath}`,
    );
  }
};

export const readTrackedSourceFile = (
  root: string,
  relativePath: string,
): string => {
  const descriptor = openTrackedSource(root, relativePath, constants.O_RDONLY);
  try {
    return readFileSync(descriptor, "utf8");
  } finally {
    closeSync(descriptor);
  }
};

export const writeTrackedSourceFile = (
  root: string,
  relativePath: string,
  contents: string,
): void => {
  const descriptor = openTrackedSource(root, relativePath, constants.O_WRONLY);
  try {
    ftruncateSync(descriptor, 0);
    writeFileSync(descriptor, contents, "utf8");
  } finally {
    closeSync(descriptor);
  }
};

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
