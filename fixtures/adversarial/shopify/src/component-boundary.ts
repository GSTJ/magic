// NOT reported: the entry point is the supported surface.
import { Card } from "../components/Card.ts";
// Reported: reaching past a component's entry point into its internals — the
// thing `@shopify/strict-component-boundaries` existed to stop. It cannot load
// under oxlint (`unable to load resolver "node"`), and `no-restricted-imports`
// `patterns` covers it without one.
import { Internal } from "../components/Card/internal/thing.ts";

export const all = [Card, Internal];
