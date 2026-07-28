/**
 * React component detection, derived from `eslint-plugin-react-native@5.0.0`
 * (`lib/util/Components.js`, itself derived from `eslint-plugin-react`).
 *
 * Copyright (c) 2015 Tom Hastjarjanto. Licensed under the MIT licence; the full
 * notice is in `THIRD-PARTY-NOTICES.md` next to this package's README.
 *
 * Only one rule needs this: `no-unused-styles` reports nothing in a file where
 * upstream found no component it is confident about. That gate is the reason a
 * `styles.ts` module full of sheets consumed elsewhere stays quiet, so it has
 * to be reproduced rather than assumed away.
 *
 * Upstream tracks a confidence per candidate node (0 banned, 1 maybe, 2 yes)
 * and the gate asks whether any candidate reached 2. This keeps that model.
 *
 * **Divergence: the walk is over `node.parent`, not over scopes.** Upstream
 * calls `sourceCode.getScope(node)` and climbs `scope.upper` looking for the
 * enclosing class or function. oxlint exposes `getScope`, but the parent chain
 * is exposed too and produces the same enclosing-function sequence, without
 * depending on how oxlint's scope manager names its scopes. Verified equal on
 * the parity corpus, which covers a class component, a block-bodied function
 * returning JSX, an arrow with an expression body, `React.createElement`, a
 * JSX-returning callback (which must NOT count) and a `this`-bearing function
 * (which must ban itself).
 *
 * **Divergence: `ClassProperty` is not handled.** Upstream registers a
 * `ClassProperty` visitor, which no parser has emitted since ESTree renamed the
 * node to `PropertyDefinition`; under oxlint the visitor is never called, so
 * porting it would add a branch upstream does not actually run.
 */

import type { RuleContext } from "../../rule-api.ts";
import type { Node } from "./stylesheet.ts";

const asNode = (value: unknown): Node | undefined =>
  (value ?? undefined) as Node | undefined;

const ES6_COMPONENT = /^(?:React\.)?(?:Pure)?Component$/;
const ES5_COMPONENT = /^(?:React\.)?createClass$/;

const isFunctionish = (node: Node | undefined): boolean =>
  typeof node?.type === "string" && node.type.includes("Function");

/** The node's own id: upstream keys the candidate list by source range. */
const idOf = (node: Node): string => {
  const range = node.range as [number, number] | undefined;
  if (range) return range.join(":");
  return `${String(node.start)}:${String(node.end)}`;
};

export type ComponentDetector = {
  /** Feed every visited node in; returns nothing. */
  visit: (node: Node) => void;
  /** Did any candidate reach confidence 2? */
  found: () => boolean;
  reset: () => void;
};

export const createComponentDetector = (
  context: RuleContext,
): ComponentDetector => {
  let confidence = new Map<string, number>();

  const text = (node: unknown): string =>
    context.sourceCode?.getText?.(node) ??
    context.getSourceCode?.()?.getText?.(node) ??
    "";

  /**
   * Confidence 0 is sticky in both directions: once a candidate is banned it
   * stays banned, and banning wins over a later `2`. Upstream's `add()`.
   */
  const add = (node: Node, level: number): void => {
    const id = idOf(node);
    const current = confidence.get(id);
    if (current === undefined) {
      confidence.set(id, level);
      return;
    }
    confidence.set(
      id,
      current === 0 || level === 0 ? 0 : Math.max(current, level),
    );
  };

  const ancestors = function* (node: Node): Generator<Node> {
    let current: Node | undefined = node;
    while (current) {
      yield current;
      current = asNode(current.parent);
    }
  };

  const isES6Component = (node: Node): boolean =>
    Boolean(node.superClass) && ES6_COMPONENT.test(text(node.superClass));

  const isES5Component = (node: Node): boolean => {
    const parent = asNode(node.parent);
    if (!parent?.callee) return false;
    return ES5_COMPONENT.test(text(parent.callee));
  };

  /**
   * The enclosing function that could be a component. A class method is not one
   * (the class is), and neither is a function passed as an argument — that is
   * `items.map(() => <Row/>)`, a callback, not a component.
   */
  const parentComponent = (node: Node): Node | undefined => {
    for (const candidate of ancestors(node)) {
      if (
        (candidate.type === "ClassDeclaration" ||
          candidate.type === "ClassExpression") &&
        isES6Component(candidate)
      ) {
        return candidate;
      }

      if (candidate.type === "ObjectExpression" && isES5Component(candidate)) {
        return candidate;
      }

      if (isFunctionish(candidate)) {
        const parent = asNode(candidate.parent);
        if (
          parent?.type !== "MethodDefinition" &&
          parent?.type !== "CallExpression"
        ) {
          return candidate;
        }
      }
    }

    return undefined;
  };

  const returnsJSX = (node: Node): boolean => {
    let value: Node | undefined;
    if (node.type === "ReturnStatement") value = asNode(node.argument);
    else if (node.type === "ArrowFunctionExpression") value = asNode(node.body);
    else return false;

    if (value?.type === "JSXElement" || value?.type === "JSXFragment") {
      return true;
    }
    return asNode(asNode(value?.callee)?.property)?.name === "createElement";
  };

  const visit = (node: Node): void => {
    switch (node.type) {
      case "ClassDeclaration": {
        if (isES6Component(node)) add(node, 2);
        return;
      }

      case "ObjectExpression": {
        if (isES5Component(node)) add(node, 2);
        return;
      }

      case "FunctionExpression":
      case "FunctionDeclaration": {
        const component = parentComponent(node);
        if (component) add(component, 1);
        return;
      }

      case "ArrowFunctionExpression": {
        const component = parentComponent(node);
        if (!component) return;
        // ESTree's `expression` flag means "this arrow has an expression body".
        // Derived from the body when a parser omits the flag, so the branch
        // cannot silently collapse to "never a component".
        const hasExpressionBody =
          node.expression === undefined
            ? asNode(node.body)?.type !== "BlockStatement"
            : Boolean(node.expression);
        add(component, hasExpressionBody && returnsJSX(node) ? 2 : 1);
        return;
      }

      case "ThisExpression": {
        const component = parentComponent(node);
        if (component && isFunctionish(component)) add(component, 0);
        return;
      }

      case "ReturnStatement": {
        if (!returnsJSX(node)) return;
        const component = parentComponent(node);
        if (component) add(component, 2);
        break;
      }

      default:
        break;
    }
  };

  return {
    visit,
    found: () => [...confidence.values()].some((level) => level >= 2),
    reset: () => {
      confidence = new Map();
    },
  };
};
