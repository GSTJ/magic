import type { DetectMode } from "./detect.ts";

import {
  assertCleanTree,
  gitMoveViaTemp,
  repoRoot,
  trackedFiles,
} from "./git.ts";
import { buildPlan, type RenamePlan } from "./plan.ts";
import { findStaleReferences } from "./references.ts";
import { createResolver } from "./resolve.ts";
import { type Edit, type ManualReview, rewriteImports } from "./rewrite.ts";

export type KebabOptions = {
  readonly cwd: string;
  readonly paths: string[];
  readonly write: boolean;
  readonly allowDirty: boolean;
  readonly detect: DetectMode;
  /** Explicit tsconfigs whose `paths` drive alias rewriting. Empty = discover. */
  readonly tsconfigs: string[];
  /** `Button.tsx` → `btn.tsx`, keyed by old basename. */
  readonly overrides: Map<string, string>;
};

export type KebabResult = {
  readonly root: string;
  readonly plan: RenamePlan;
  readonly edits: Edit[];
  readonly manual: ManualReview[];
  readonly tsconfigPaths: string[];
  readonly applied: boolean;
};

/**
 * Order matters and is not the obvious one: **rewrite first, move second.**
 *
 * Import specifiers are rewritten to point at names that do not exist yet, then
 * the files are moved to make them true. The reverse order would mean resolving
 * specifiers against a tree that is half-renamed, where `./Button` is ambiguous
 * between the file that moved and the one that has not. Between the two phases
 * the tree does not typecheck, which is fine — nothing observes it, and the
 * clean-tree precondition means a single `git checkout .` undoes both.
 */
export const runKebabCodemod = (options: KebabOptions): KebabResult => {
  const root = repoRoot(options.cwd);
  if (!options.allowDirty) assertCleanTree(root);

  const plan = buildPlan(
    root,
    options.paths,
    options.detect,
    options.overrides,
  );
  const tracked = trackedFiles(root);
  const resolver = createResolver(root, options.tsconfigs);

  const { edits, manual } = rewriteImports(
    root,
    plan.renames,
    tracked,
    resolver,
    options.write,
  );

  const stale = findStaleReferences(root, plan.renames, tracked);

  if (options.write) {
    for (const rename of plan.renames) {
      gitMoveViaTemp(root, rename.from, rename.to);
    }
  }

  return {
    root,
    plan,
    edits,
    manual: [...manual, ...stale],
    tsconfigPaths: resolver.tsconfigPaths,
    applied: options.write,
  };
};

export const summarise = (result: KebabResult): string => {
  const { plan } = result;
  return (
    `${plan.renames.length} rename${plan.renames.length === 1 ? "" : "s"}, ` +
    `${result.edits.length} specifier rewrite${result.edits.length === 1 ? "" : "s"}, ` +
    `${plan.skipped.length} skipped, ${plan.conflicts.length} conflict${plan.conflicts.length === 1 ? "" : "s"}, ` +
    `${result.manual.length} needing review`
  );
};

export type { DetectMode } from "./detect.ts";
export { CodemodError } from "./git.ts";
export {
  isKebabCase,
  kebabifyBasename,
  kebabifyStem,
  stemOf,
} from "./kebab.ts";
export type { Conflict, Rename, RenamePlan, Skipped } from "./plan.ts";
export type { Edit, ManualReview } from "./rewrite.ts";
export { skipReasonFor } from "./skip.ts";
