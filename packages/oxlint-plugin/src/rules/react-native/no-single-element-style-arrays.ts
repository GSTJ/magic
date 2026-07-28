/**
 * Port of `react-native/no-single-element-style-arrays` from
 * `eslint-plugin-react-native@5.0.0`
 * (`lib/rules/no-single-element-style-arrays.js`).
 *
 * Copyright (c) 2015 Tom Hastjarjanto. Licensed under the MIT licence; the full
 * notice is in `THIRD-PARTY-NOTICES.md` next to this package's README.
 *
 * `style={[styles.row]}` allocates a fresh array on every render for no reason:
 * the array's identity changes, so the prop is never equal to last render's.
 * Write `style={styles.row}`.
 *
 * Note the asymmetry with `no-inline-styles`, which is upstream's and is kept:
 * that rule matches any attribute whose name *contains* "style", this one
 * matches `style` exactly, so `contentContainerStyle={[a]}` is not reported.
 *
 * **One divergence, and it is a crash fix.** Upstream reads
 * `node.value.expression` with no null check, so a valueless `<View style />`
 * throws a `TypeError` out of the visitor. Under oxlint that does not fail one
 * rule — it aborts the JS plugin host for the whole file, so every rule in this
 * plugin goes quiet on it. Measured against `eslint-plugin-react-native@5.0.0`
 * under oxlint 1.75.0: `Error running JS plugin … Cannot read properties of
 * null (reading 'expression')`. Guarded here.
 */

import type { Node } from "./stylesheet.ts";

import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
  type RuleFixer,
} from "../../rule-api.ts";

const MESSAGE_ID = "singleElementStyleArray";

export const noSingleElementStyleArrays: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow single-element style arrays in JSX style props",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]:
        "Single element style arrays are not necessary and cause unnecessary re-renders",
    },
    schema: [],
    fixable: "code",
  },

  createChecks(context: RuleContext) {
    return {
      JSXAttribute(node: unknown) {
        const attribute = node as Node;
        if ((attribute.name as Node | undefined)?.name !== "style") return;

        const value = attribute.value as Node | null | undefined;
        const expression = value?.expression as Node | undefined;
        if (expression?.type !== "ArrayExpression") return;

        const elements = (expression.elements ?? []) as Node[];
        if (elements.length !== 1) return;

        context.report({
          node,
          messageId: MESSAGE_ID,
          fix: (fixer: RuleFixer) =>
            fixer.replaceText(
              expression,
              context.sourceCode?.getText?.(elements[0]) ?? "",
            ),
        });
      },
    };
  },
});

export default noSingleElementStyleArrays;
