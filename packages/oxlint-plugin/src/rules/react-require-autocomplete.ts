import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../rule-api.ts";

interface Options {
  /** Component names that render an `<input>` and forward its props. */
  inputComponents?: string[];
}

const MESSAGE_ID = "requireAutocomplete";

/**
 * The `type` values the HTML spec gives an autofill field for. Copied from
 * `@shopify/react-require-autocomplete`; `checkbox`, `radio`, `file`, `hidden`,
 * `submit`, `reset`, `button` and `image` are absent because the browser has
 * nothing to autofill there.
 */
const AUTOCOMPLETE_INPUT_TYPES = new Set([
  "color",
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "range",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

const attributeName = (attribute: unknown): string | undefined => {
  const attr = attribute as {
    type?: string;
    name?: { type?: string; name?: string };
  };
  if (attr?.type !== "JSXAttribute") return undefined;
  return attr.name?.name;
};

/**
 * Port of `@shopify/react-require-autocomplete`.
 *
 * A text-ish `<input>` with no `autoComplete` gets whatever the browser guesses,
 * which is how password managers fill an address into a one-time-code box and
 * how mobile keyboards come up with the wrong layout. `autoComplete="off"` is a
 * legitimate answer — the rule wants the decision made, not a particular value.
 *
 * `jsx-a11y/autocomplete-valid` is *not* this rule and does not substitute for
 * it: it validates the value of an `autoComplete` attribute that is already
 * there. Verified against oxlint 1.75.0 — `<input type="text" />` produces no
 * `autocomplete-valid` diagnostic, while
 * `<input type="text" autoComplete="bogusvalue" />` does.
 *
 * The upstream rule loads and fires correctly as an oxlint jsPlugin, so this is
 * a port for weight rather than compatibility: pulling in
 * `@shopify/eslint-plugin` for it costs every consumer 262 transitive packages
 * and ~97 MB, most of it a second copy of the ESLint ecosystem.
 *
 * Two deliberate divergences from upstream, both to cut false positives:
 *
 * - An element with a spread attribute (`<input {...props} />`) is skipped.
 *   `autoComplete` may well be in the spread, and upstream reports regardless.
 * - A computed `type` (`<input type={kind} />`) is skipped. Upstream's
 *   `getPropValue` yields nothing for those and its `|| 'text'` fallback then
 *   treats them as text, reporting on inputs that may be checkboxes.
 *
 * Stack-specific (web forms), so opt-in like everything else here — React
 * Native has no `autoComplete`-by-that-name story worth policing this way.
 */
export const reactRequireAutocomplete: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require an autoComplete attribute on autofillable input types",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]:
        '`<{{element}}>` of type `{{inputType}}` has no `autoComplete`. The browser will guess, which is how password managers fill the wrong field. Set a token from the HTML autofill list, or `autoComplete="off"` if that is the intent.',
    },
    schema: [
      {
        type: "object",
        properties: {
          inputComponents: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },

  createChecks(context: RuleContext) {
    let elements = new Set(["input"]);

    return {
      before() {
        const options = (context.options?.[0] ?? {}) as Options;
        elements = new Set(["input", ...(options.inputComponents ?? [])]);
      },

      JSXOpeningElement(node: unknown) {
        const element = node as {
          name?: { type?: string; name?: string };
          attributes?: unknown[];
        };

        // `<Foo.Bar>` is a JSXMemberExpression and has no `name`; nothing to
        // match against the configured list.
        if (element.name?.type !== "JSXIdentifier") return;
        const elementName = element.name.name;
        if (!elementName || !elements.has(elementName)) return;

        const attributes = element.attributes ?? [];

        if (
          attributes.some(
            (attribute) =>
              (attribute as { type?: string }).type === "JSXSpreadAttribute",
          )
        ) {
          return;
        }

        const typeAttribute = attributes.find(
          (attribute) => attributeName(attribute) === "type",
        ) as { value?: { type?: string; value?: unknown } } | undefined;

        let inputType = "text";
        if (typeAttribute) {
          const { value } = typeAttribute;
          // A bare `<input type />` is `value: null`, and `type={kind}` is a
          // JSXExpressionContainer. Neither tells us what the input is.
          if (value?.type !== "Literal" || typeof value.value !== "string") {
            return;
          }
          inputType = value.value.toLowerCase();
        }

        if (!AUTOCOMPLETE_INPUT_TYPES.has(inputType)) return;

        // React spells it `autoComplete`, the DOM attribute is `autocomplete`,
        // and both appear in real code. Upstream's `hasProp` is case-insensitive
        // by default, so match that.
        const hasAutocomplete = attributes.some(
          (attribute) =>
            attributeName(attribute)?.toLowerCase() === "autocomplete",
        );
        if (hasAutocomplete) return;

        context.report({
          node,
          messageId: MESSAGE_ID,
          data: { element: elementName, inputType },
        });
      },
    };
  },
});

export default reactRequireAutocomplete;
