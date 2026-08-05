import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";

import { site } from "./site";

/**
 * `baseUrl` is the application route, so it stays `/` while `basePath` adds
 * `/magic` at the edges. Prefixing here would double it.
 */
export const source = loader({
  baseUrl: site.docsPath,
  source: docs.toFumadocsSource(),
});
