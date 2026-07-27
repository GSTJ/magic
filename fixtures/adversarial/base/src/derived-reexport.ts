// M18 shape: a module that re-exports imported names in TWO `export { … }`
// statements with unrelated exports between them.
//
// oxlint 1.75.0's `unicorn/prefer-export-from` fixer replaces the whole span
// from the first re-export to the last with a single `export … from`, deleting
// everything in between. Under `--fix-suggestions` this silently removed an
// `export const` and an `export type` from a real repo; the corrupted value only
// surfaced because two tests asserted on it.
//
// The preset now ships the rule OFF. `run.mjs` asserts both that it does not
// fire here and that `oxlint --fix-suggestions` leaves this file byte-identical.
import { NAME, TIMEOUT_MS, type Thing } from "./reexport-source.ts";

export { NAME };

export const TIMEOUT_SECONDS = TIMEOUT_MS / 1000;
export type Alias = Thing;

export { TIMEOUT_MS };
