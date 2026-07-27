import {
  currentFilename,
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../rule-api.ts";

interface Options {
  /**
   * Which files count as a barrel. Substring match against the POSIX-normalised
   * path, so `"/src/index.ts"` matches `packages/foo/src/index.ts`.
   */
  files?: string[];
  /** Paths that may keep a wildcard re-export (same substring matching). */
  allow?: string[];
}

const MESSAGE_ID = "noBarrelFile";

const DEFAULT_FILES = [
  "/src/index.ts",
  "/src/index.tsx",
  "/index.ts",
  "/index.tsx",
];

/**
 * Ban catch-all barrels (`export * from "./thing"`) in package entry points.
 *
 * A wildcard re-export drags every transitive symbol into every consumer's
 * module graph, defeats explicit subpath exports, and makes the public API
 * impossible to read. This generalises the `scripts/no-barrel.sh` gate from
 * invest-radar into a lint rule, so it reports at the right line and honours
 * normal disable comments instead of failing a separate CI step.
 *
 * Named re-exports (`export { a, b } from "./thing"`) are fine and not flagged.
 */
export const noBarrelFile: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow catch-all `export * from` barrels in entry points",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]:
        'Catch-all barrel: `export * from "{{source}}"`. Re-export the specific symbols, or give consumers a subpath export instead.',
    },
    schema: [
      {
        type: "object",
        properties: {
          files: { type: "array", items: { type: "string" } },
          allow: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },

  createChecks(context: RuleContext) {
    let active = false;

    const readOptions = (): Options => (context.options?.[0] ?? {}) as Options;

    return {
      before() {
        const options = readOptions();
        const path = currentFilename(context).replaceAll("\\", "/");
        const barrelPatterns = options.files ?? DEFAULT_FILES;
        const allowed = options.allow ?? [];

        active =
          barrelPatterns.some((pattern) => path.endsWith(pattern)) &&
          !allowed.some((pattern) => path.includes(pattern));
      },

      ExportAllDeclaration(node: unknown) {
        if (!active) return;

        // `export type * from "./x"` is erased at compile time — it drags
        // nothing into the consumer's runtime module graph, which is this
        // rule's rationale. Whether type-only barrels are wanted is a separate
        // policy question; flagging them with a runtime-cost message would be
        // wrong either way.
        if ((node as { exportKind?: string }).exportKind === "type") return;

        const source = (node as { source?: { value?: unknown } }).source?.value;
        context.report({
          node,
          messageId: MESSAGE_ID,
          data: { source: typeof source === "string" ? source : "…" },
        });
      },
    };
  },
});

export default noBarrelFile;
