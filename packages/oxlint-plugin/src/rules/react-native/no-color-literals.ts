/**
 * Port of `react-native/no-color-literals` from
 * `eslint-plugin-react-native@5.0.0` (`lib/rules/no-color-literals.js`).
 *
 * Copyright (c) 2015 Tom Hastjarjanto. Licensed under the MIT licence; the full
 * notice is in `THIRD-PARTY-NOTICES.md` next to this package's README.
 *
 * A hard-coded `#ff0000` is a colour that cannot follow a theme. The rule looks
 * at any property whose name contains "color", in a JSX style prop or inside
 * `StyleSheet.create`, and wants the value to come from somewhere nameable.
 *
 * Scope worth knowing: only the *top level* of each style object is inspected,
 * so a colour nested one object deeper is not seen. That is upstream's reach and
 * this port does not widen it — widening would report code that passes today.
 *
 * As in `no-inline-styles`, upstream's unused `Components.detect` wrapper is
 * dropped; no branch here consults the component list.
 */

import { inspect } from "node:util";

import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../../rule-api.ts";
import {
  collectColorLiterals,
  isStyleAttribute,
  isStyleSheetDeclaration,
  type Node,
  type StyleFinding,
  styleDeclarations,
  styleSheetObjectNames,
} from "./stylesheet.ts";

const MESSAGE_ID = "colorLiteral";

export const noColorLiterals: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow colour literals in styles, in JSX or in StyleSheet.create",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]: "Color literal: {{expression}}",
    },
    schema: [],
  },

  createChecks(context: RuleContext) {
    let findings: StyleFinding[] = [];
    let objectNames = ["StyleSheet"];

    return {
      before() {
        findings = [];
        objectNames = styleSheetObjectNames(context);
      },

      CallExpression(node: unknown) {
        if (!isStyleSheetDeclaration(node, objectNames)) return;
        for (const style of styleDeclarations(node as Node)) {
          findings.push(...collectColorLiterals(context, style.value));
        }
      },

      JSXAttribute(node: unknown) {
        if (!isStyleAttribute(node)) return;
        const { value } = node as { value?: unknown };
        findings.push(...collectColorLiterals(context, value));
      },

      after() {
        for (const finding of findings) {
          context.report({
            node: finding.node,
            messageId: MESSAGE_ID,
            data: { expression: inspect(finding.expression) },
          });
        }
        findings = [];
      },
    };
  },
});

export default noColorLiterals;
