import { createMagicDocsPublicPaths, defineMagicDocs } from "magic-docs";

/**
 * One contract for the whole site. `siteUrl` carries the GitHub Pages project
 * path, so `/magic` reaches `basePath`, the canonical URLs and every string
 * Next cannot prefix on its own.
 */
export const site = defineMagicDocs({
  name: "magic",
  description:
    "Change a lint rule or a CI step once, and every repo importing this one picks it up on its next run.",
  siteUrl: "https://gstj.github.io/magic",
  repository: "https://github.com/GSTJ/magic",
});

export const publicPaths = createMagicDocsPublicPaths(site);
