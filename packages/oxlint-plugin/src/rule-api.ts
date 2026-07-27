/**
 * Rule authoring shim.
 *
 * oxlint ships a faster rule API — `createOnce()` — where the visitor object is
 * built once and reused for every file, instead of being rebuilt per file like
 * ESLint's `create()`. oxlint's own types spell out how the two coexist: "`Rule`
 * can have either `create` method, or `createOnce` method. If `createOnce`
 * method is present, `create` is ignored." (`oxlint/dist/plugins-dev.d.ts`,
 * `CreateOnceRule`.)
 *
 * So every rule ships **both**, unconditionally. oxlint picks `createOnce` and
 * ignores `create`; ESLint knows nothing about `createOnce` and uses `create`.
 * No environment detection — probing for an oxlint export would only tell us
 * oxlint is *installed*, not that it is the thing currently linting.
 *
 * `createChecks` is written once and feeds both. Anything that depends on the
 * current file — the filename and `context.options`, which oxlint documents as
 * "rule options for this rule on this file" — must be read inside `before()`,
 * because under `createOnce` the surrounding closure runs only once for the
 * whole lint run.
 */

export interface RuleContext {
  options?: unknown[];
  getFilename?: () => string;
  filename?: string;
  sourceCode?: {
    getAncestors?: (node: unknown) => { type?: string }[];
    getText?: (node?: unknown) => string;
    getScope?: (node: unknown) => unknown;
  };
  report: (descriptor: {
    node: unknown;
    messageId: string;
    data?: Record<string, string>;
    fix?: (fixer: RuleFixer) => unknown;
  }) => void;
}

export interface RuleFixer {
  remove: (node: unknown) => unknown;
  replaceText: (node: unknown, text: string) => unknown;
  replaceTextRange: (range: [number, number], text: string) => unknown;
}

/**
 * Visitor map. `before` runs at the start of each file and `after` at the end,
 * under both APIs — the `create` wrapper below reproduces oxlint's hook
 * semantics for ESLint.
 */
export type RuleVisitors = Record<string, unknown> & {
  before?: () => void;
  after?: () => void;
};

export interface RuleMeta {
  type: "problem" | "suggestion" | "layout";
  docs: { description: string; recommended: boolean };
  messages: Record<string, string>;
  schema: unknown[];
  fixable?: "code" | "whitespace";
}

export interface EslintRuleModule {
  meta: RuleMeta;
  create: (context: RuleContext) => Record<string, unknown>;
  createOnce: (context: RuleContext) => RuleVisitors;
}

export const defineOxlintRule = (rule: {
  meta: RuleMeta;
  createChecks: (context: RuleContext) => RuleVisitors;
}): EslintRuleModule => {
  const { meta, createChecks } = rule;

  return {
    meta,

    // oxlint's path. The visitor is built once for the whole run; `before` and
    // `after` are called by oxlint around each file.
    createOnce: createChecks,

    // ESLint's path, ignored by oxlint. ESLint builds a fresh visitor per file,
    // so calling `before` here is exactly equivalent to oxlint calling it at
    // the start of each file. `after` maps onto `Program:exit`.
    create(context) {
      const visitors = createChecks(context);
      visitors.before?.();

      const { before: _before, after, ...rest } = visitors;
      if (!after) return rest;

      const ownProgramExit = rest["Program:exit"] as
        | ((node: unknown) => void)
        | undefined;

      return {
        ...rest,
        "Program:exit": (node: unknown) => {
          ownProgramExit?.(node);
          after();
        },
      };
    },
  };
};

/** Read the current file's path across both APIs and both ESLint generations. */
export const currentFilename = (context: RuleContext): string => {
  if (typeof context.getFilename === "function") return context.getFilename();
  return context.filename ?? "";
};

/**
 * Optional chaining (`api?.things.useQuery()`, `vi.mock?.("x")`) wraps the
 * callee in a `ChainExpression` node. Rules that match on
 * `callee.type === "MemberExpression"` silently miss those call sites unless
 * they unwrap it first — every callee-matching rule in this plugin goes
 * through here.
 */
export const unwrapCallee = (
  callee: unknown,
): { type?: string; object?: unknown; property?: unknown } => {
  const node = callee as { type?: string; expression?: unknown };
  if (node?.type === "ChainExpression") {
    return node.expression as {
      type?: string;
      object?: unknown;
      property?: unknown;
    };
  }
  return node as { type?: string; object?: unknown; property?: unknown };
};
