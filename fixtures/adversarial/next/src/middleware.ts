// Next statically analyses this export and understands a fixed set of node
// types. `unicorn/prefer-string-raw` autofixed the matcher into
// String.raw`…`, and `next build` then failed with
// `Unsupported node type "TaggedTemplateExpression"` — while lint, typecheck
// and tests all stayed green.
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
