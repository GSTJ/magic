/**
 * Port of `react-native/no-inline-styles` from
 * `eslint-plugin-react-native@5.0.0` (`lib/rules/no-inline-styles.js`).
 *
 * Copyright (c) 2015 Tom Hastjarjanto. Licensed under the MIT licence; the full
 * notice is in `THIRD-PARTY-NOTICES.md` next to this package's README.
 *
 * An object literal written straight into a `style` prop is a new object on
 * every render, and it is invisible to `StyleSheet`'s registry, so it is
 * re-serialised across the bridge each time. Move it into `StyleSheet.create`.
 *
 * Upstream reports on the *object literal*, not the attribute, and prints the
 * literal values it found via `util.inspect`. Both are reproduced: the message
 * text and the span are what a consumer's snapshot of a lint run contains.
 *
 * Upstream drags in the whole component-detection helper here through
 * `Components.detect`, then never asks it anything — no branch in this rule
 * reads the component list. Not carried over; the diagnostics are identical.
 */

import { inspect } from "node:util";

import {
  defineOxlintRule,
  type EslintRuleModule,
  type RuleContext,
} from "../../rule-api.ts";
import {
  collectInlineStyles,
  isStyleAttribute,
  type StyleFinding,
} from "./stylesheet.ts";

const MESSAGE_ID = "inlineStyle";

export const noInlineStyles: EslintRuleModule = defineOxlintRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow inline style objects in JSX style props",
      recommended: false,
    },
    messages: {
      [MESSAGE_ID]: "Inline style: {{expression}}",
    },
    schema: [],
  },

  createChecks(context: RuleContext) {
    let findings: StyleFinding[] = [];

    return {
      before() {
        findings = [];
      },

      JSXAttribute(node: unknown) {
        if (!isStyleAttribute(node)) return;
        const { value } = node as { value?: unknown };
        findings.push(...collectInlineStyles(context, value));
      },

      // Upstream collects through the file and reports at `Program:exit`, which
      // is what fixes the report order. Kept, so diagnostics stay in the same
      // sequence for anything diffing lint output.
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

export default noInlineStyles;
