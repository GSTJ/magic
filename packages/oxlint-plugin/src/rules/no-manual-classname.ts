import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../rule-api.ts";

type Options = {
  /** JSX attribute names whose value must not be composed by hand. */
  attributes?: string[];
  /**
   * The approved composition helpers, most-preferred first. See the note on
   * `composer` below for what this list does and does not change.
   */
  composers?: string[];
};

const DEFAULT_ATTRIBUTES = ["className", "class"];

/**
 * The helpers the GSTJ repos actually import for this job, most-used first:
 * `cn` 457 call sites, `cva` 20, then `twMerge` 6, `clsx` 5 and `cx` 1, which
 * appear only inside the six `cn` definitions themselves. `cn` is the shadcn
 * wrapper — `twMerge(clsx(inputs))` — that `components.json` generates into
 * `@/lib/utils` in four of the repos.
 *
 * `tv` is absent on purpose: `tailwind-variants` is not a dependency of any
 * GSTJ repo, so defaulting to it would be advice nobody can follow. It costs
 * nothing, because this list does not gate anything — see `composer` below.
 */
const DEFAULT_COMPOSERS = ["cn", "cva", "twMerge", "clsx", "cx"];

type Shape =
  | { messageId: "template" }
  | { messageId: "concatenation" }
  | { messageId: "conditional"; operator: string };

/** How the `indirect` message describes the offending initialiser. */
const SHAPE_PROSE: Record<Shape["messageId"], string> = {
  template: "a template literal with an interpolation",
  concatenation: "string concatenation",
  conditional: "a conditional",
};

type Node = { type?: string; [key: string]: unknown };

/** A `className` value whose own shape is the offence. */
type Offence = { node: unknown; attribute: string; shape: Shape };

/** A `className={name}` site, resolved against the tainted `const`s. */
type Reference = { node: unknown; attribute: string; name: string };

/**
 * `foo as string`, `foo!` and friends wrap the expression that matters. None of
 * them changes what renders, so none of them should change what is reported.
 */
const unwrap = (node: unknown): Node | undefined => {
  let current = node as Node | undefined;
  while (
    current?.type === "TSAsExpression" ||
    current?.type === "TSSatisfiesExpression" ||
    current?.type === "TSNonNullExpression" ||
    current?.type === "TSInstantiationExpression" ||
    current?.type === "ChainExpression"
  ) {
    current = (current.expression as Node | undefined) ?? undefined;
  }
  return current;
};

/** Walk `SIDE_CLASS[side].base` back to the leading `SIDE_CLASS` identifier. */
const memberRoot = (node: unknown): string | undefined => {
  let current = unwrap(node);
  while (current?.type === "MemberExpression") {
    current = unwrap(current.object);
  }
  return current?.type === "Identifier"
    ? (current.name as string | undefined)
    : undefined;
};

/**
 * The four shapes that count as composing a class string by hand.
 *
 * `||` and `??` are deliberately absent. In an attribute they read as a
 * default (`className={custom ?? "p-2"}`), not as "add this class when" — the
 * inverse of `&&`, which nobody writes for classes.
 */
const classify = (expression: unknown): Shape | undefined => {
  const node = unwrap(expression);

  if (node?.type === "TemplateLiteral") {
    const expressions = node.expressions as unknown[] | undefined;
    return expressions && expressions.length > 0
      ? { messageId: "template" }
      : undefined;
  }

  if (node?.type === "BinaryExpression") {
    return node.operator === "+" ? { messageId: "concatenation" } : undefined;
  }

  if (node?.type === "ConditionalExpression") {
    return { messageId: "conditional", operator: "?:" };
  }

  if (node?.type === "LogicalExpression" && node.operator === "&&") {
    return { messageId: "conditional", operator: "&&" };
  }

  return undefined;
};

/**
 * Every name a binding pattern introduces. `({ className, ...rest })` binds two
 * names, and the rule has to know about both — a `className` prop sitting in
 * the same file as a hand-built `const className` is what makes name matching
 * ambiguous, and ambiguity is what makes it give up.
 */
const bindingNames = (pattern: unknown, bind: (name: string) => void): void => {
  const node = pattern as Node | undefined;

  if (node?.type === "Identifier") {
    const name = node.name as string | undefined;
    if (name) bind(name);
    return;
  }

  if (node?.type === "ObjectPattern") {
    for (const property of (node.properties as Node[] | undefined) ?? []) {
      bindingNames(
        property?.type === "RestElement" ? property.argument : property?.value,
        bind,
      );
    }
    return;
  }

  if (node?.type === "ArrayPattern") {
    for (const element of (node.elements as unknown[] | undefined) ?? []) {
      bindingNames(element, bind);
    }
    return;
  }

  if (node?.type === "AssignmentPattern") {
    bindingNames(node.left, bind);
    return;
  }

  if (node?.type === "RestElement") bindingNames(node.argument, bind);
};

/**
 * `const SIDE_CLASS = { left: " ws-x-left", right: " ws-x-right" }` — a lookup
 * table of class strings, i.e. a variant axis someone declared as an object
 * because `cva`/`tv` was not reached for. Two entries minimum: a one-entry
 * object is not a variant axis, it is a constant.
 */
const isClassLookupTable = (init: unknown): boolean => {
  const node = unwrap(init);
  if (node?.type !== "ObjectExpression") return false;

  const properties = (node.properties as Node[] | undefined) ?? [];
  if (properties.length < 2) return false;

  return properties.every((property) => {
    if (property?.type !== "Property") return false;
    const value = unwrap(property.value) as
      | { type?: string; value?: unknown }
      | undefined;
    return value?.type === "Literal" && typeof value.value === "string";
  });
};

/**
 * Ban composing a `className` by hand; route it through `cn()` / `cva()` / `tv()`.
 *
 * Tailwind class strings are not ordinary strings. Two classes that set the
 * same property both survive a `+` or a `${}` and the winner is decided by the
 * order they happen to sit in the generated stylesheet, not by the order they
 * are written — which is the entire reason `tailwind-merge` exists. And a
 * conditional in the attribute forces every branch to repeat the classes the
 * branches share, so they drift.
 *
 * The specific shape this was written for:
 *
 * ```tsx
 * const SIDE_CLASS: Record<Side, string> = {
 *   left: " ws-marginalia-left",
 *   right: " ws-marginalia-right",
 *   inline: "",
 * };
 * const className = `ws-marginalia${SIDE_CLASS[side]}`;
 * <span className={className} />
 * ```
 *
 * (That is `gabriel-taveira-portfolio/src/components/portfolio/marginalia.tsx`,
 * verbatim.) The leading spaces are the tell — they are load-bearing whitespace
 * holding a hand-rolled variant table together. `cva`/`tv` declare exactly
 * that, with the base separated from the variants and no whitespace to get
 * wrong. Note the composition happens in a `const`, one line above the JSX,
 * which is why the rule follows a same-file `const` into the attribute instead
 * of only inspecting `JSXAttribute` values.
 *
 * **Only the shape of the value is inspected, never inside a call.** A call is
 * never reported, so `cn("base", side === "left" && "ws-x-left")` passes: the
 * conditional is an argument, and arguments are the composer's business. That
 * is why there is no `allowTernaryInCn`-style option — there is nothing to
 * allow.
 *
 * What it deliberately does not catch:
 *
 * - `element.className = ...` outside JSX. Real in this codebase
 *   (`invest-radar/sources/browser-ext/entrypoints/popup/main.ts`), but that is
 *   a DOM property assignment in a package with no `cn` to route it through.
 * - A `let`, or a name declared twice in the file. Following either needs flow
 *   analysis; a `const` used once is the shape that actually shows up.
 * - Composition that crosses a function or module boundary —
 *   `className={buildClasses(side)}`. The helper may well use `cn` internally,
 *   and reporting it would be a guess.
 * - A lookup table imported from another module is still reported, just with
 *   the generic `template` message: the `cva`/`tv` one needs the object literal
 *   in view.
 *
 * Deliberately not auto-fixable. Wrapping the existing expression in `cn()`
 * mechanically produces the same class string, which is not the fix — the point
 * is to split it into arguments so `clsx` can drop the falsy ones and
 * `tailwind-merge` can resolve the conflicts. A fixer that did that would have
 * to decide where each piece belongs, and getting it wrong silently changes
 * what renders.
 *
 * Stack-specific (Tailwind / NativeWind + a `cn` helper), so opt-in like
 * everything else in this plugin.
 */
export const noManualClassname: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow composing className by hand; use cn() for conditionals and cva()/tv() for variants",
      recommended: false,
    },
    messages: {
      template:
        "`{{attribute}}` is assembled by interpolating into a template literal. Nothing drops a falsy piece and nothing resolves two classes that set the same property — `p-2` and `p-4` both survive and the stylesheet order decides. Pass the pieces to `{{composer}}(...)` instead. If the interpolated part selects a variant (size, side, tone), declare it with `cva`/`tv`.",
      concatenation:
        "`{{attribute}}` is assembled with `+`. Concatenation cannot drop a falsy piece, cannot resolve two conflicting Tailwind classes, and loses a separating space the first time someone forgets one. Pass the pieces to `{{composer}}(...)` instead.",
      conditional:
        '`{{attribute}}` picks its classes with `{{operator}}` in the attribute itself. Every branch has to repeat the classes the branches share, and nothing merges a conflict between them. `{{composer}}("base", cond && "variant")` for a one-off; `cva`/`tv` once the branches are a real variant axis.',
      classMap:
        "`{{attribute}}` interpolates `{{map}}`, a hand-rolled variant table — a `Record` of class strings whose leading spaces are load-bearing. That is what `cva`/`tv` are for: declare the base once and the axes as `variants`, then call it. Use `{{composer}}(...)` when you only need to merge, not to declare variants.",
      indirect:
        "`{{name}}` is assembled by hand ({{shape}}) and then used as `{{attribute}}`. Moving the composition one line up does not change what it renders. Build it with `{{composer}}(...)`, or declare it as a `cva`/`tv` variant.",
    },
    schema: [
      {
        type: "object",
        properties: {
          attributes: { type: "array", items: { type: "string" } },
          composers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },

  createChecks(context: RuleContext) {
    let attributes = new Set(DEFAULT_ATTRIBUTES);
    let composer: string = DEFAULT_COMPOSERS[0] ?? "cn";

    /** Offending attribute values, reported in `after()`. */
    let direct: Offence[] = [];
    /** `className={someIdentifier}` sites, resolved against `tainted`. */
    let references: Reference[] = [];
    /** How many times each name is declared in this file. */
    let declarations = new Map<string, number>();
    /** `const` names whose initialiser is one of the banned shapes. */
    let tainted = new Map<string, { shape: Shape; init: unknown }>();
    /** `const` names bound to a lookup table of class strings. */
    let classMaps = new Set<string>();

    const declare = (name: string): void => {
      declarations.set(name, (declarations.get(name) ?? 0) + 1);
    };

    const declareFunction = (node: unknown): void => {
      const fn = node as { params?: unknown[]; id?: unknown };
      for (const parameter of fn.params ?? []) bindingNames(parameter, declare);
      bindingNames(fn.id, declare);
    };

    /**
     * The lookup table a template literal reads from, if it reads from one.
     * Resolved in `after()` so the table can be declared below its use.
     */
    const lookupTable = (node: unknown): string | undefined => {
      const template = unwrap(node);
      if (template?.type !== "TemplateLiteral") return undefined;

      const expressions = (template.expressions as unknown[] | undefined) ?? [];
      for (const expression of expressions) {
        const root = memberRoot(expression);
        if (root !== undefined && classMaps.has(root)) return root;
      }
      return undefined;
    };

    const reportOffence = ({ node, attribute, shape }: Offence): void => {
      // A template literal that reads from a lookup table is the variant case,
      // and deserves the message that names `cva`/`tv` first.
      const map = lookupTable(node);
      if (map) {
        context.report({
          node,
          messageId: "classMap",
          data: { attribute, map, composer },
        });
        return;
      }

      context.report({
        node,
        messageId: shape.messageId,
        data: {
          attribute,
          composer,
          ...(shape.messageId === "conditional"
            ? { operator: shape.operator }
            : {}),
        },
      });
    };

    const reportReference = ({ node, attribute, name }: Reference): void => {
      const entry = tainted.get(name);
      if (!entry) return;
      // Two declarations of the same name in one file: nothing here can say
      // which one reaches the JSX, so say nothing.
      if ((declarations.get(name) ?? 0) > 1) return;

      // The screenshot's own shape — the table is interpolated one line up, not
      // in the attribute — so the variant message has to reach here too.
      const map = lookupTable(entry.init);
      if (map) {
        context.report({
          node,
          messageId: "classMap",
          data: { attribute, map, composer },
        });
        return;
      }

      context.report({
        node,
        messageId: "indirect",
        data: {
          attribute,
          composer,
          name,
          shape: SHAPE_PROSE[entry.shape.messageId],
        },
      });
    };

    return {
      before() {
        const options = (context.options?.[0] ?? {}) as Options;
        attributes = new Set(options.attributes ?? DEFAULT_ATTRIBUTES);
        // `composers` gates nothing: a call in `className` is never reported,
        // whatever it calls, because the rule only looks at the value's shape.
        // What the list decides is which name the diagnostics tell you to
        // reach for, so a repo whose helper is `tw()` gets usable advice.
        composer = (options.composers ?? DEFAULT_COMPOSERS)[0] ?? "cn";

        direct = [];
        references = [];
        declarations = new Map();
        tainted = new Map();
        classMaps = new Set();
      },

      // Every binding form that can put a name in scope. Name matching is all
      // this rule has, so a name that two of them introduce is a name it must
      // not resolve — a `className` prop next to a hand-built `const className`
      // is exactly that collision, and it is a common one.
      FunctionDeclaration: declareFunction,
      FunctionExpression: declareFunction,
      ArrowFunctionExpression: declareFunction,

      ImportDeclaration(node: unknown) {
        const declaration = node as { specifiers?: { local?: unknown }[] };
        for (const specifier of declaration.specifiers ?? []) {
          bindingNames(specifier.local, declare);
        }
      },

      VariableDeclarator(node: unknown) {
        const declarator = node as {
          id?: { type?: string; name?: string };
          init?: unknown;
          parent?: { kind?: string };
        };

        bindingNames(declarator.id, declare);

        if (declarator.id?.type !== "Identifier") return;
        const { name } = declarator.id;
        if (!name) return;

        // Only `const`. A `let` can be reassigned to something clean (or
        // something worse) between the declaration and the JSX, and following
        // that needs flow analysis this rule deliberately does not do.
        if (declarator.parent?.kind !== "const") return;
        if (!declarator.init) return;

        if (isClassLookupTable(declarator.init)) {
          classMaps.add(name);
          return;
        }

        const shape = classify(declarator.init);
        if (shape) tainted.set(name, { shape, init: declarator.init });
      },

      JSXAttribute(node: unknown) {
        const attribute = node as {
          name?: { type?: string; name?: string };
          value?: { type?: string; expression?: unknown } | null;
        };

        // `<div {...props} />` is a JSXSpreadAttribute and never lands here;
        // `<svg xlink:href>` is a JSXNamespacedName and has no plain `name`.
        if (attribute.name?.type !== "JSXIdentifier") return;
        const attributeName = attribute.name.name;
        if (!attributeName || !attributes.has(attributeName)) return;

        const { value } = attribute;
        // `className="p-2"` is a Literal, and a bare `className` is null.
        // Both are exactly what this rule is steering people towards.
        if (!value || value.type !== "JSXExpressionContainer") return;

        const expression = unwrap(value.expression);
        if (!expression) return;

        if (expression.type === "Identifier") {
          const name = expression.name as string | undefined;
          if (name) {
            references.push({
              node: value.expression,
              attribute: attributeName,
              name,
            });
          }
          return;
        }

        const shape = classify(expression);
        if (shape) {
          direct.push({
            node: value.expression,
            attribute: attributeName,
            shape,
          });
        }
      },

      after() {
        for (const offence of direct) reportOffence(offence);
        for (const reference of references) reportReference(reference);
      },
    };
  },
});

export default noManualClassname;
