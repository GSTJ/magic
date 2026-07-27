import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../rule-api.ts";

interface Options {
  /**
   * Identifiers that start a tRPC/TanStack Query call chain. The rule walks the
   * member chain back to its root identifier and only reports when that root is
   * in this list, so an unrelated `something.useQuery()` is left alone.
   */
  roots?: string[];
  /** Hook names to flag. */
  hooks?: string[];
}

const MESSAGE_ID = "preferSuspenseQuery";

const DEFAULT_ROOTS = ["api", "trpc"];
const DEFAULT_HOOKS = ["useQuery"];

/** Walk `api.foo.bar.useQuery` back to the leading `api` identifier. */
const chainRoot = (node: unknown): string | undefined => {
  let current = node as
    | { type?: string; object?: unknown; name?: string }
    | undefined;

  while (current?.type === "MemberExpression") {
    current = current.object as typeof current;
  }

  return current?.type === "Identifier" ? current.name : undefined;
};

/**
 * Steer tRPC call sites from `useQuery` to `useSuspenseQuery`.
 *
 * `useQuery` pushes loading and error handling into every component as
 * `isLoading` / `isError` branches. `useSuspenseQuery` moves both to a
 * `<Suspense>` boundary and an `<ErrorBoundary>`, so the component only ever
 * deals with data and the loading states are declared once, near the layout.
 *
 * Generalised from the g2i `prefer-suspense-query/no-use-query` rule, with the
 * chain roots made configurable rather than hardcoded.
 *
 * Deliberately not auto-fixable: renaming the hook changes the returned shape.
 * `data` stops being `T | undefined`, and `isLoading` / `isError` / `refetch`
 * usage around the call site has to be deleted or rewritten by hand. A blind
 * rename produces code that does not compile.
 *
 * Opt-in: this is tRPC-specific, so it is not part of any default preset.
 */
export const preferSuspenseQuery: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer useSuspenseQuery over useQuery for tRPC/TanStack Query call chains",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]:
        "Prefer `useSuspenseQuery` over `{{hook}}` on `{{root}}`. Handle loading with a <Suspense> boundary and errors with an <ErrorBoundary> instead of branching on isLoading/isError. Note the return shape changes: `data` is no longer possibly undefined.",
    },
    schema: [
      {
        type: "object",
        properties: {
          roots: { type: "array", items: { type: "string" } },
          hooks: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },

  createChecks(context: RuleContext) {
    let roots = new Set(DEFAULT_ROOTS);
    let hooks = new Set(DEFAULT_HOOKS);

    return {
      before() {
        const options = (context.options?.[0] ?? {}) as Options;
        roots = new Set(options.roots ?? DEFAULT_ROOTS);
        hooks = new Set(options.hooks ?? DEFAULT_HOOKS);
      },

      CallExpression(node: unknown) {
        const callee = (node as { callee?: unknown }).callee as
          | {
              type?: string;
              object?: unknown;
              property?: { type?: string; name?: string };
            }
          | undefined;

        if (callee?.type !== "MemberExpression") return;
        if (callee.property?.type !== "Identifier") return;

        const hook = callee.property.name;
        if (!hook || !hooks.has(hook)) return;

        const root = chainRoot(callee.object);
        if (!root || !roots.has(root)) return;

        context.report({ node, messageId: MESSAGE_ID, data: { hook, root } });
      },
    };
  },
});

export default preferSuspenseQuery;
