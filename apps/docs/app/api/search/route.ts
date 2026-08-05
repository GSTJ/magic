import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// The export writes this once; `staticGET` is the index the client downloads.
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source);
