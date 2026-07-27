// Reported: each of these routes through the index file of this file's own
// directory or an ancestor of it.
import { alpha } from "..";
import { charlie } from "../../index.ts";
// NOT reported: `../elsewhere/index.ts` goes *down* into a sibling directory
// before hitting an index, which is ordinary. This is the case a naive
// "specifier contains index" check gets wrong.
import { delta } from "../elsewhere/index.ts";
import { bravo } from "./index.ts";
// NOT reported: names a real file.
import { echo } from "./sibling.ts";

export const all = [alpha, bravo, charlie, delta, echo];

// Beyond upstream, which only hooked ImportDeclaration: the re-export forms
// carry the identical cycle hazard.
export * from "../..";
export { foxtrot } from ".";
