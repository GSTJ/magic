import { defineOxlintRule, type EslintRuleModule } from "../rule-api.ts";

interface Options {
  /**
   * How many statements may live inside the sole `if` block before the rule
   * stops complaining. `0` — the value the ESLint config used — means *any*
   * function whose whole body is one `if` should invert the condition and
   * return early.
   */
  maximumStatements?: number;
}

const MESSAGE_ID = "preferEarlyReturn";

/**
 * Port of `@shopify/prefer-early-return`, which has no oxlint equivalent.
 *
 * Flags a function whose entire body is a single `if` statement with no `else`,
 * where the consequent holds more than `maximumStatements` statements. Inverting
 * the condition and returning early removes a level of nesting.
 *
 * Not auto-fixable: inverting a condition correctly needs to understand
 * `&&`/`||` precedence and negation of the specific test expression, and a
 * blind `!(...)` wrapper produces worse code than the original.
 */
export const preferEarlyReturn: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer inverting a lone wrapping `if` and returning early over nesting the whole function body",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]:
        "Prefer an early return to wrapping the whole function body in an `if`. Invert the condition and `return` when it fails.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maximumStatements: { type: "number", minimum: 0 },
        },
        additionalProperties: false,
      },
    ],
  },

  createChecks(context) {
    const options = (context.options?.[0] ?? {}) as Options;
    const maximumStatements = options.maximumStatements ?? 0;

    const checkFunctionBody = (node: {
      body?: {
        type?: string;
        body?: { type?: string; alternate?: unknown; consequent?: unknown }[];
      };
    }) => {
      const { body } = node;
      // An expression-bodied arrow (`() => x`) has no block to analyse.
      if (!body || body.type !== "BlockStatement") return;

      const statements = body.body ?? [];
      if (statements.length !== 1) return;

      const [only] = statements;
      if (!only || only.type !== "IfStatement") return;
      // `else` means both branches matter; there is nothing to invert into.
      if (only.alternate) return;

      const consequent = only.consequent as
        | { type?: string; body?: unknown[] }
        | undefined;
      if (!consequent) return;

      const consequentStatements =
        consequent.type === "BlockStatement"
          ? (consequent.body ?? [])
          : [consequent];

      if (consequentStatements.length <= maximumStatements) return;

      context.report({ node: only, messageId: MESSAGE_ID });
    };

    return {
      FunctionDeclaration: checkFunctionBody,
      FunctionExpression: checkFunctionBody,
      ArrowFunctionExpression: checkFunctionBody,
    };
  },
});

export default preferEarlyReturn;
