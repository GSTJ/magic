import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../rule-api.ts";

const MESSAGE_ID = "ancestorDirectoryImport";

/**
 * A path segment is an `index` file if its basename without the final extension
 * is exactly `index` — `index`, `index.ts`, `index.tsx`, `index.js`. Not
 * `index.module.css`, whose basename is `index.module`.
 */
const isIndexSegment = (segment: string): boolean => {
  const lastDot = segment.lastIndexOf(".");
  const base = lastDot > 0 ? segment.slice(0, lastDot) : segment;
  return base === "index";
};

/**
 * True when the specifier points at the index file of the importing file's own
 * directory or one of its ancestors: `"."`, `".."`, `"../.."`, `"./index"`,
 * `"../../index.ts"`, and the trailing-slash spellings of each.
 *
 * `"./foo"` and `"../foo/index"` are not — those reach *sideways or down* into
 * a sibling directory, which is ordinary and not what this rule is about.
 */
const isAncestorIndexSpecifier = (source: string): boolean => {
  if (!source.startsWith(".")) return false;
  // A Windows-style specifier is not legal in an import, but normalise anyway
  // so a hand-written config or codemod can't sneak one past.
  const segments = source
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment !== "");

  if (segments.length === 0) return false;

  const last = segments.at(-1) ?? "";
  const withoutIndex = isIndexSegment(last) ? segments.slice(0, -1) : segments;

  // `"./index"` reduces to `["."]`; `"index"` alone would reduce to `[]`, but
  // that is a bare specifier and was rejected above.
  if (withoutIndex.length === 0) return false;

  return withoutIndex.every((segment) => segment === "." || segment === "..");
};

/**
 * Port of `@shopify/no-ancestor-directory-import`, reimplemented without a
 * module resolver.
 *
 * Reaching back up to a directory's `index` — `import { thing } from ".."` —
 * is how import cycles get built: the ancestor index re-exports the very file
 * doing the importing, so the module graph loops through the barrel and the
 * evaluation order becomes load-order dependent. It also hides the real
 * dependency, because the specifier names a directory rather than the file the
 * symbol actually lives in.
 *
 * **Why a port and not the upstream rule.** `@shopify/eslint-plugin` loads fine
 * as an oxlint jsPlugin, but this rule calls `eslint-module-utils/resolve`,
 * which dies under oxlint with `Resolve error: unable to load resolver "node".`
 * — the same failure `@shopify/strict-component-boundaries` hits. Verified
 * against oxlint 1.75.0 and `@shopify/eslint-plugin@50.0.0`.
 *
 * **Fidelity.** Upstream resolves the specifier and then compares the resolved
 * path against the importing file, reporting when the difference is a single
 * `index` segment. That is exactly the set of specifiers made only of `.`/`..`
 * segments with an optional trailing `index`, which is decidable from syntax
 * alone — so the resolver bought nothing here. The one behavioural difference:
 * upstream stays silent when the specifier fails to resolve (a `".."` with no
 * index file behind it), where this reports. Such an import does not typecheck
 * either way.
 *
 * Beyond the original: re-export forms (`export * from ".."`,
 * `export { x } from "."`) are covered too. They carry the identical cycle
 * hazard and upstream only missed them because it hooked `ImportDeclaration`
 * alone. Dynamic `import("..")` is not covered.
 *
 * Not auto-fixable: the fix is to name the file the symbol really comes from,
 * which means resolving the barrel's re-exports — exactly the resolution step
 * that is unavailable here.
 */
export const noAncestorDirectoryImport: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing an ancestor (or own) directory's index file",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]:
        "Ancestor directory import: `{{source}}`. This routes through an index file that re-exports the current file, which is how import cycles start. Import directly from the file the symbol is defined in.",
    },
    schema: [],
  },

  createChecks(context: RuleContext) {
    const check = (node: unknown) => {
      const source = (node as { source?: { value?: unknown } }).source?.value;
      if (typeof source !== "string") return;
      if (!isAncestorIndexSpecifier(source)) return;

      context.report({ node, messageId: MESSAGE_ID, data: { source } });
    };

    return {
      ImportDeclaration: check,
      ExportAllDeclaration: check,
      // `export { x } from "."` has a source; a plain `export { x }` does not,
      // and `check` bails on the missing string.
      ExportNamedDeclaration: check,
    };
  },
});

export default noAncestorDirectoryImport;
