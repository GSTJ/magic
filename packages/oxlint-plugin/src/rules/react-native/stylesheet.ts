/**
 * Style-sheet AST helpers, derived from `eslint-plugin-react-native@5.0.0`
 * (`lib/util/stylesheet.js`).
 *
 * Copyright (c) 2015 Tom Hastjarjanto. Licensed under the MIT licence; the full
 * notice is in `THIRD-PARTY-NOTICES.md` next to this package's README.
 *
 * The shape of every predicate below is upstream's, on purpose: these helpers
 * decide which nodes four rules report, and the point of the port is that the
 * diagnostics do not move. Where upstream throws on a node real code produces,
 * the divergence is called out at the site and in the rule that depends on it.
 */

import type { RuleContext } from "../../rule-api.ts";

export type Node = { type?: string; [key: string]: unknown };

/** A reportable finding: the object literal, plus the values that made it one. */
export type StyleFinding = { node: Node; expression: Record<string, unknown> };

const asNode = (value: unknown): Node | undefined =>
  (value ?? undefined) as Node | undefined;

const asNodes = (value: unknown): Node[] =>
  Array.isArray(value) ? (value as Node[]) : [];

/**
 * `settings["react-native/style-sheet-object-names"]`, upstream's escape hatch
 * for `EStyleSheet.create` and friends. oxlint passes `settings` through to JS
 * plugins verbatim — verified on 1.75.0 — so the setting keeps working.
 */
export const styleSheetObjectNames = (context: RuleContext): string[] => {
  const configured = (context.settings ?? {})[
    "react-native/style-sheet-object-names"
  ];
  return Array.isArray(configured) ? (configured as string[]) : ["StyleSheet"];
};

/** `StyleSheet.create(...)`, for any of the configured object names. */
export const isStyleSheetDeclaration = (
  node: unknown,
  objectNames: string[],
): boolean => {
  const call = asNode(node);
  if (call?.type !== "CallExpression") return false;

  const callee = asNode(call.callee);
  const object = asNode(callee?.object);
  const property = asNode(callee?.property);

  return (
    typeof object?.name === "string" &&
    objectNames.includes(object.name) &&
    property?.name === "create"
  );
};

/**
 * The name the sheet is bound to. `StyleSheet.create({...})` that is not
 * assigned to anything has none, and upstream files those entries under the
 * string `"undefined"` — which is what its message then prints. Reproduced:
 * changing it would move a diagnostic.
 */
export const styleSheetName = (node: Node): string => {
  const parent = asNode(node.parent);
  const id = asNode(parent?.id);
  return typeof id?.name === "string" ? id.name : "undefined";
};

/** The `Property` entries of the object handed to `StyleSheet.create`. */
export const styleDeclarations = (node: Node): Node[] => {
  const [first] = asNodes(node.arguments);
  return asNodes(first?.properties).filter(
    (property) => property.type === "Property",
  );
};

/**
 * Upstream matches *any* attribute whose name contains "style", case
 * insensitively — `contentContainerStyle` and `myStyleThing` both count.
 * `no-single-element-style-arrays` deliberately does not use this; it matches
 * `style` exactly. That asymmetry is upstream's and is preserved.
 */
export const isStyleAttribute = (node: unknown): boolean => {
  const attribute = asNode(node);
  if (attribute?.type !== "JSXAttribute") return false;
  const name = asNode(attribute.name)?.name;
  return typeof name === "string" && name.toLowerCase().includes("style");
};

/** `<View style={[a, b]} />` — the only array shape upstream unpacks. */
const arrayElements = (node: Node | undefined): Node[] | undefined => {
  if (node?.type !== "JSXExpressionContainer") return undefined;
  const expression = asNode(node.expression);
  if (expression?.type !== "ArrayExpression") return undefined;
  return asNodes(expression.elements);
};

const sourceText = (context: RuleContext, node: unknown): string =>
  context.sourceCode?.getText?.(node) ??
  context.getSourceCode?.()?.getText?.(node) ??
  "";

/**
 * Collect from an object literal, then from the two expression shapes that can
 * hide one: `a && {...}` and `cond ? {...} : {...}`. Anything else — an
 * identifier, a call, a member expression — is not an inline object and yields
 * nothing.
 */
const fromExpression = (
  node: unknown,
  collect: (object: Node) => StyleFinding | undefined,
): StyleFinding[] => {
  const current = asNode(node);
  if (!current) return [];

  if (current.type === "ObjectExpression") {
    const finding = collect(current);
    return finding ? [finding] : [];
  }

  if (
    current.type === "LogicalExpression" ||
    current.type === "ConditionalExpression"
  ) {
    const [left, right] =
      current.type === "LogicalExpression"
        ? [current.left, current.right]
        : [current.consequent, current.alternate];
    return [
      ...fromExpression(left, collect),
      ...fromExpression(right, collect),
    ];
  }

  return [];
};

/** `cond ? "red" : x` counts when either branch is a literal, and prints as source. */
const literalConditional = (
  context: RuleContext,
  value: Node,
): { value: unknown } | undefined => {
  if (value.type !== "ConditionalExpression") return undefined;
  const consequent = asNode(value.consequent);
  const alternate = asNode(value.alternate);
  if (consequent?.type !== "Literal" && alternate?.type !== "Literal") {
    return undefined;
  }
  return { value: sourceText(context, value) };
};

/**
 * The value shapes that make a property "inline": a literal, a conditional with
 * a literal branch, and unary `-`/`+` on a literal. Anything else — an
 * identifier, a call, a nested object — is not one.
 */
const inlineValue = (
  context: RuleContext,
  value: Node,
): { value: unknown } | undefined => {
  if (value.type === "Literal") return { value: value.value };

  const conditional = literalConditional(context, value);
  if (conditional) return conditional;

  if (value.type !== "UnaryExpression") return undefined;
  const argument = asNode(value.argument);
  if (argument?.type !== "Literal") return undefined;
  if (value.operator === "-") return { value: -1 * (argument.value as number) };
  // Upstream stores a unary `+`'s operand unchanged, so `+1` prints as `1`.
  if (value.operator === "+") return { value: argument.value };
  return undefined;
};

/** Colours have no unary branch: `-1` is not a colour. */
const colorValue = (
  context: RuleContext,
  value: Node,
): { value: unknown } | undefined => {
  if (value.type === "Literal") return { value: value.value };
  return literalConditional(context, value);
};

/**
 * Walk one object literal's own properties, keeping whichever the given value
 * matcher accepts. One accepted property makes the whole object reportable, and
 * the accepted values become the message's payload.
 *
 * A property with no `key` (a spread) or no `value` is skipped, which is why
 * `style={{ ...base }}` is silent.
 */
const objectFinding = (
  object: Node,
  keyFilter: (name: string | undefined) => boolean,
  match: (value: Node) => { value: unknown } | undefined,
): StyleFinding | undefined => {
  const expression: Record<string, unknown> = {};
  let invalid = false;

  for (const property of asNodes(object.properties)) {
    const value = asNode(property.value);
    const key = asNode(property.key);
    // Upstream indexes by `key.name`, which is `undefined` for a string-literal
    // or numeric key — so `{ "padding": 8 }` prints as `{ undefined: 8 }`.
    // Kept, because the key only ever reaches the message text.
    const name = key?.name as string | undefined;

    if (value && key && keyFilter(name)) {
      const matched = match(value);
      if (matched) {
        invalid = true;
        expression[name as string] = matched.value;
      }
    }
  }

  return invalid ? { node: object, expression } : undefined;
};

const anyKey = (): boolean => true;

const colorKey = (name: string | undefined): boolean =>
  typeof name === "string" && name.toLowerCase().includes("color");

/** `no-inline-styles`: the objects reachable from a `style`-ish attribute value. */
export const collectInlineStyles = (
  context: RuleContext,
  attributeValue: unknown,
): StyleFinding[] => {
  const value = asNode(attributeValue);
  const elements = arrayElements(value);
  const collect = (object: Node) =>
    objectFinding(object, anyKey, (node) => inlineValue(context, node));

  if (elements) {
    return elements.flatMap((element) => fromExpression(element, collect));
  }

  // A bare `style` attribute (`value === null`) and `style="text"` (a Literal
  // with no `.expression`) both land here and yield nothing.
  return value?.expression ? fromExpression(value.expression, collect) : [];
};

/**
 * `no-color-literals`: the same reachability, plus the bare-object entry point
 * the `StyleSheet.create` path needs (`style.value` is already an
 * ObjectExpression there, not a JSX container).
 */
export const collectColorLiterals = (
  context: RuleContext,
  from: unknown,
): StyleFinding[] => {
  const value = asNode(from);
  if (!value) return [];

  const collect = (object: Node) =>
    objectFinding(object, colorKey, (node) => colorValue(context, node));

  const elements = arrayElements(value);
  if (elements) {
    return elements.flatMap((element) => fromExpression(element, collect));
  }

  if (value.type === "ObjectExpression") return fromExpression(value, collect);

  return fromExpression(value.expression, collect);
};

/**
 * `styles.container` — an `x.y` where both halves are plain identifiers and the
 * whole thing is not itself the object of another member expression. That last
 * clause is why `styles.a.color` marks nothing as used.
 */
export const potentialStyleReference = (node: Node): string | undefined => {
  const object = asNode(node.object);
  const property = asNode(node.property);
  const parent = asNode(node.parent);

  if (
    object?.type === "Identifier" &&
    typeof object.name === "string" &&
    property?.type === "Identifier" &&
    typeof property.name === "string" &&
    parent?.type !== "MemberExpression"
  ) {
    return `${object.name}.${property.name}`;
  }

  return undefined;
};
