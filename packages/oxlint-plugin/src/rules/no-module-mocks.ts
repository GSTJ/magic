import {
  currentFilename,
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
  unwrapCallee,
} from "../rule-api.ts";

interface Options {
  /** Mock namespaces to police. Defaults to both vitest and jest. */
  objects?: string[];
  /** Method names on those namespaces that constitute module-level mocking. */
  methods?: string[];
  /** Files the rule applies to, as a regex source string. */
  testFilePattern?: string;
}

const MESSAGE_ID = "noModuleMocks";
const CONDITIONAL_MESSAGE_ID = "mockInConditional";

const DEFAULT_OBJECTS = ["vi", "jest"];
const DEFAULT_METHODS = [
  "mock",
  "doMock",
  "unmock",
  "doUnmock",
  "mocked",
  "importMock",
  "requireMock",
  "hoisted",
];
// Matches the preset's test-file convention: `*.test.*` / `*.spec.*` files,
// plus anything under a `__tests__/` directory (Jest's default, which needs no
// infix at all).
const DEFAULT_TEST_FILE_PATTERN = String.raw`\.(test|spec)\.(ts|tsx|js|jsx|mjs|mts|cts)$|[\\/]__tests__[\\/]`;

const CONDITIONAL_TYPES = new Set([
  "IfStatement",
  "ConditionalExpression",
  "SwitchStatement",
]);

/**
 * Ban module-level mocking (`vi.mock` / `jest.mock`) in test files.
 *
 * Module mocks couple a test to the module graph rather than to behaviour: they
 * break on rename, they hide real integration failures, and they make the test
 * pass for reasons unrelated to the code under test. Prefer dependency
 * injection and real collaborators.
 *
 * Generalised from the g2i `testing-policy/no-module-mocks` rule, which was
 * vitest-only. Opt-in — this is a policy, not a bug detector, and a repo that
 * has decided otherwise should be able to just not enable it.
 *
 * Not auto-fixable: deleting a `vi.mock()` call leaves a test that imports the
 * real module and almost certainly fails. The removal has to be paired with a
 * rewrite the fixer can't do.
 */
export const noModuleMocks: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow module-level mocking (vi.mock / jest.mock) in test files",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]:
        "Module-level mocking: {{object}}.{{method}}(). Prefer dependency injection and real collaborators over mocking the module graph.",
      [CONDITIONAL_MESSAGE_ID]:
        "Module-level mocking: {{object}}.{{method}}() inside a conditional. Mock calls are hoisted, so this does not do what it looks like — move it to the top level or remove it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          objects: { type: "array", items: { type: "string" } },
          methods: { type: "array", items: { type: "string" } },
          testFilePattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },

  createChecks(context: RuleContext) {
    let isTestFile = false;
    let objects = new Set(DEFAULT_OBJECTS);
    let methods = new Set(DEFAULT_METHODS);

    return {
      before() {
        const options = (context.options?.[0] ?? {}) as Options;
        objects = new Set(options.objects ?? DEFAULT_OBJECTS);
        methods = new Set(options.methods ?? DEFAULT_METHODS);

        const pattern = new RegExp(
          options.testFilePattern ?? DEFAULT_TEST_FILE_PATTERN,
        );
        isTestFile = pattern.test(currentFilename(context));
      },

      CallExpression(node: unknown) {
        if (!isTestFile) return;

        const callee = unwrapCallee((node as { callee?: unknown }).callee);
        if (callee?.type !== "MemberExpression") return;

        const object = callee.object as
          | { type?: string; name?: string }
          | undefined;
        const property = callee.property as
          | { type?: string; name?: string }
          | undefined;
        if (object?.type !== "Identifier" || property?.type !== "Identifier")
          return;
        if (!object.name || !property.name) return;
        if (!objects.has(object.name) || !methods.has(property.name)) return;

        const ancestors = context.sourceCode?.getAncestors?.(node) ?? [];
        const insideConditional = ancestors.some(
          (ancestor) =>
            ancestor.type !== undefined && CONDITIONAL_TYPES.has(ancestor.type),
        );

        context.report({
          node,
          messageId: insideConditional ? CONDITIONAL_MESSAGE_ID : MESSAGE_ID,
          data: { object: object.name, method: property.name },
        });
      },
    };
  },
});

export default noModuleMocks;
