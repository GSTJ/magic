import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../rule-api.ts";

type Options = {
  /**
   * How many values a hook's returned tuple may hold. Upstream hardcodes 2;
   * this exposes it, because "two" is a house-style number rather than a fact
   * about React.
   */
  maximumReturnValues?: number;
};

const MESSAGE_ID = "hooksStrictReturn";

const DEFAULT_MAXIMUM = 2;

/** React's own convention for what counts as a hook. */
const HOOK_NAME = /^use[A-Z0-9]/;

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

type AstNode = {
  type?: string;
  id?: { type?: string; name?: string };
  argument?: { type?: string; elements?: unknown[] } | null;
};

/**
 * Name of the nearest enclosing function, if that function is a hook.
 *
 * `ancestors` runs root-first, so walking backwards finds the innermost
 * function first — which means a `return` inside a callback nested in a hook is
 * attributed to the callback, not the hook.
 */
const enclosingHookName = (ancestors: AstNode[]): string | undefined => {
  const index = ancestors.findLastIndex(
    (node) => node.type !== undefined && FUNCTION_TYPES.has(node.type),
  );
  if (index === -1) return undefined;

  const enclosing = ancestors[index];

  if (enclosing?.type === "FunctionDeclaration") {
    const { name } = enclosing.id ?? {};
    return name && HOOK_NAME.test(name) ? name : undefined;
  }

  // `const useThing = () => …` — the name lives on the declarator.
  const parent = ancestors[index - 1];
  if (parent?.type !== "VariableDeclarator") return undefined;
  if (parent.id?.type !== "Identifier") return undefined;

  const { name } = parent.id;
  return name && HOOK_NAME.test(name) ? name : undefined;
};

/**
 * Port of `@shopify/react-hooks-strict-return`.
 *
 * A hook returning `[a, b, c, d]` forces every call site to memorise a
 * positional order that nothing checks — swap two elements and the code still
 * compiles when the types line up. Two is the limit that keeps
 * `const [value, setValue] = useThing()` readable; past that, return an object
 * and let the call site destructure by name.
 *
 * Object returns are never reported, at any size. That is the escape hatch, not
 * an oversight, and it matches upstream: the rule's own message is "a tuple of
 * two or fewer values **or a single object**".
 *
 * The upstream rule loads and fires correctly as an oxlint jsPlugin. This is a
 * port for weight: `@shopify/eslint-plugin` costs 262 transitive packages and
 * ~97 MB, which is not a trade worth making for one opinionated rule.
 *
 * **Fidelity.** Upstream additionally resolves an indirect return — `const pair
 * = [a, b, c]; return pair;` — through scope analysis, and expands spread
 * elements the same way. That path is dropped here: it only fires when the
 * array literal is in scope and assigned to the returned identifier, which is a
 * shape a `useX` hook rarely has, and reimplementing it would mean walking
 * `variable.references` for a case the direct check already covers wherever it
 * matters. A `SpreadElement` counts as one value rather than being expanded, so
 * this errs toward silence.
 *
 * Not auto-fixable: converting a tuple to an object rewrites every call site's
 * destructuring, and the names to use are a judgement call.
 *
 * React-specific, so opt-in like everything else here.
 */
export const reactHooksStrictReturn: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Restrict how many values a React hook may return as a tuple",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]:
        "`{{hook}}` returns a tuple of {{count}} values; the limit is {{maximum}}. Positional order past that is unreadable and unenforced — return a single object and let call sites destructure by name.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maximumReturnValues: { type: "number", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
  },

  createChecks(context: RuleContext) {
    let maximum = DEFAULT_MAXIMUM;

    return {
      before() {
        const options = (context.options?.[0] ?? {}) as Options;
        maximum = options.maximumReturnValues ?? DEFAULT_MAXIMUM;
      },

      ReturnStatement(node: unknown) {
        const { argument } = node as AstNode;
        // `return;` and `return foo;` — only a literal tuple is countable here.
        if (argument?.type !== "ArrayExpression") return;

        const count = (argument.elements ?? []).length;
        if (count <= maximum) return;

        const ancestors = (context.sourceCode?.getAncestors?.(node) ??
          []) as AstNode[];
        const hook = enclosingHookName(ancestors);
        if (!hook) return;

        context.report({
          node,
          messageId: MESSAGE_ID,
          data: { hook, count: String(count), maximum: String(maximum) },
        });
      },
    };
  },
});

export default reactHooksStrictReturn;
