import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { type DetectMode, detectViolations } from "./detect.ts";
import { CodemodError } from "./git.ts";
import { isKebabCase, stemOf } from "./kebab.ts";
import { skipReasonFor } from "./skip.ts";

export type Rename = {
  readonly from: string;
  readonly to: string;
  readonly reason: "violation" | "paired-mock" | "override";
};

export type Skipped = {
  readonly path: string;
  readonly rule: string;
  readonly explanation: string;
};

export type Conflict = {
  readonly from: string;
  readonly to: string;
  readonly detail: string;
};

export type RenamePlan = {
  readonly renames: Rename[];
  readonly skipped: Skipped[];
  readonly conflicts: Conflict[];
  readonly detectedBy: DetectMode;
};

const withBasename = (relativePath: string, name: string): string => {
  const directory = dirname(relativePath);
  return directory === "." ? name : `${directory}/${name}`;
};

/**
 * A `__mocks__/Button.ts` sitting beside a `Button.tsx` that we are renaming is
 * a mock of *our* module, not of a package, so it has to move in lockstep or
 * jest silently stops applying it. `skip.ts` lets that case through; this pairs
 * it up and gives it the same target stem.
 */
const pairedMocks = (root: string, renames: Rename[]): Rename[] =>
  renames.flatMap((rename) => {
    const mocksDirectory = join(dirname(rename.from), "__mocks__");
    if (!existsSync(join(root, mocksDirectory))) return [];

    const oldStem = stemOf(basename(rename.from));
    const newStem = stemOf(basename(rename.to));

    return readdirSync(join(root, mocksDirectory))
      .filter((entry) => stemOf(entry) === oldStem)
      .map((entry) => ({
        from: `${mocksDirectory}/${entry}`,
        to: `${mocksDirectory}/${newStem}${entry.slice(oldStem.length)}`,
        reason: "paired-mock" as const,
      }));
  });

type Triage = {
  readonly rename?: Rename;
  readonly skip?: Skipped;
  readonly conflict?: Conflict;
};

const triage = (
  root: string,
  path: string,
  suggested: string,
  overrides: Map<string, string>,
): Triage => {
  const override = overrides.get(basename(path));
  const target = override ?? suggested;

  // An explicit `--rename` is a human overruling the skip list on purpose, so
  // it is the one thing that gets past it.
  const reason = override === undefined ? skipReasonFor(root, path) : undefined;
  if (reason) {
    return {
      skip: { path, rule: reason.rule, explanation: reason.explanation },
    };
  }

  if (target.includes("/") || target.includes("\\")) {
    return {
      conflict: {
        from: path,
        to: target,
        detail:
          "Rename target must be a bare basename — magic-kebab never moves a file " +
          "between directories, only re-cases it in place.",
      },
    };
  }

  if (!isKebabCase(target)) {
    return {
      conflict: {
        from: path,
        to: target,
        detail: `\`${target}\` still violates unicorn/filename-case, so the rename would not fix anything.`,
      },
    };
  }

  return {
    rename: {
      from: path,
      to: withBasename(path, target),
      reason: override === undefined ? "violation" : "override",
    },
  };
};

/**
 * A `--rename` key that matches nothing in the plan.
 *
 * `--rename` exists for the cases where a human has overruled the codemod —
 * CONFLICTS resolution, acronyms like `S3.ts`. Keys are full basenames
 * *including the extension*; `--rename zodI18n=zod-i18n` used to be accepted,
 * silently ignored, and the file renamed to the codemod's own target instead.
 * So an ignored key means the human's decision was discarded on exactly the
 * files someone looked at carefully — which is why this is fatal rather than a
 * warning.
 */
const assertOverridesMatched = (
  overrides: Map<string, string>,
  violations: { path: string }[],
): void => {
  const basenames = new Set(
    violations.map((violation) => basename(violation.path)),
  );
  const unmatched = [...overrides.keys()].filter((key) => !basenames.has(key));
  if (unmatched.length === 0) return;

  const lines = unmatched.map((key) => {
    const candidates = [...basenames].filter(
      (name) => stemOf(name) === key || name.startsWith(`${key}.`),
    );
    const hint =
      candidates.length > 0
        ? ` Did you mean ${candidates
            .map((name) => `\`${name}=${overrides.get(key) ?? ""}\``)
            .join(" or ")}? Keys are full basenames, extension included.`
        : " No file in the plan has that basename.";
    return `  --rename ${key}=${overrides.get(key) ?? ""}${hint}`;
  });

  throw new CodemodError(
    `${unmatched.length} --rename override${unmatched.length === 1 ? "" : "s"} matched nothing:\n${lines.join("\n")}`,
  );
};

export const buildPlan = (
  root: string,
  paths: string[],
  mode: DetectMode,
  overrides: Map<string, string>,
): RenamePlan => {
  const violations = detectViolations(root, paths, mode);
  assertOverridesMatched(overrides, violations);

  const triaged = violations.map((violation) =>
    triage(root, violation.path, violation.target, overrides),
  );

  const renames = triaged
    .map((entry) => entry.rename)
    .filter((rename): rename is Rename => rename !== undefined);
  const skipped = triaged
    .map((entry) => entry.skip)
    .filter((skip): skip is Skipped => skip !== undefined);
  const conflicts = triaged
    .map((entry) => entry.conflict)
    .filter((conflict): conflict is Conflict => conflict !== undefined);

  // Under `--detect builtin` a `__mocks__/Button.ts` is reported on its own
  // *and* picked up as the paired mock of `Button.tsx`. Same rename, twice.
  const all = [...renames, ...pairedMocks(root, renames)].filter(
    (rename, index, list) =>
      list.findIndex((other) => other.from === rename.from) === index,
  );

  // Collision detection folds case, because the filesystem this runs on does.
  // Two files that differ only in case cannot both survive a rename into the
  // same directory, and halfway through a `git mv` sequence is the worst
  // possible time to discover that.
  const byTarget = new Map<string, Rename[]>();
  for (const rename of all) {
    const key = rename.to.toLowerCase();
    byTarget.set(key, [...(byTarget.get(key) ?? []), rename]);
  }

  const safe: Rename[] = [];
  for (const rename of all) {
    const clashing = byTarget.get(rename.to.toLowerCase()) ?? [];
    const occupied =
      existsSync(join(root, rename.to)) &&
      rename.to.toLowerCase() !== rename.from.toLowerCase();

    if (clashing.length > 1) {
      conflicts.push({
        from: rename.from,
        to: rename.to,
        detail: `Collides with ${clashing
          .filter((other) => other.from !== rename.from)
          .map((other) => other.from)
          .join(", ")} — all of them want this name.`,
      });
    } else if (occupied) {
      conflicts.push({
        from: rename.from,
        to: rename.to,
        detail: "A different file already occupies that name.",
      });
    } else {
      safe.push(rename);
    }
  }

  return {
    renames: safe.sort((a, b) => (a.from < b.from ? -1 : 1)),
    skipped,
    conflicts,
    detectedBy: mode,
  };
};
