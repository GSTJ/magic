import { createRequire } from "node:module";

/**
 * Rule authoring shim.
 *
 * oxlint ships a faster rule API — `defineRule({ meta, createOnce })` — where
 * the visitor object is built once and reused for every file, instead of being
 * rebuilt per file like ESLint's `create()`. When the rule runs under oxlint we
 * want that path; when it runs under plain ESLint (or under an oxlint old
 * enough not to export `defineRule`) we need the classic one.
 *
 * `createChecks` is written once and used by both. Anything that depends on the
 * current file — the filename, most obviously — must be read inside `before()`,
 * because under `createOnce` the surrounding closure runs only once for the
 * whole lint run.
 *
 * This mirrors the pattern used in the g2i work repo's JS plugins.
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

/** Visitor map. `before` runs at the start of each file under both APIs. */
export type RuleVisitors = Record<string, unknown> & {
  before?: () => void;
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
  create?: (context: RuleContext) => Record<string, unknown>;
  createOnce?: (context: RuleContext) => RuleVisitors;
}

const require_ = createRequire(import.meta.url);

const loadDefineRule = ():
  | ((rule: unknown) => EslintRuleModule)
  | undefined => {
  try {
    const oxlint = require_("oxlint") as {
      defineRule?: (rule: unknown) => EslintRuleModule;
    };
    return typeof oxlint.defineRule === "function"
      ? oxlint.defineRule
      : undefined;
  } catch {
    // Running under plain ESLint, or oxlint isn't resolvable from here.
    return undefined;
  }
};

const defineRule = loadDefineRule();

export const defineOxlintRule = (rule: {
  meta: RuleMeta;
  createChecks: (context: RuleContext) => RuleVisitors;
}): EslintRuleModule => {
  const { meta, createChecks } = rule;

  if (defineRule) {
    return defineRule({ meta, createOnce: createChecks });
  }

  return {
    meta,
    create(context) {
      const visitors = createChecks(context);
      // ESLint builds a fresh visitor per file, so calling `before` here is
      // exactly equivalent to oxlint calling it at the start of each file.
      visitors.before?.();

      const { before: _before, ...rest } = visitors;
      return rest;
    },
  };
};

/** Read the current file's path across both APIs and both ESLint generations. */
export const currentFilename = (context: RuleContext): string => {
  if (typeof context.getFilename === "function") return context.getFilename();
  return context.filename ?? "";
};
