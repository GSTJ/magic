import base from "magic-oxfmt-config";

// Same shared config, but internalPattern rewritten from perfectionist GLOBS
// to oxfmt PREFIXES (which is what oxfmt's schema actually documents).
export default {
  ...base,
  sortImports: {
    ...(base.sortImports as object),
    internalPattern: ["~/", "@/", "#"],
  },
};
