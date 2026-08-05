import type { NextConfig } from "next";

import { createMDX } from "fumadocs-mdx/next";
import { createMagicDocsStaticExport } from "magic-docs";

import { site } from "./lib/site";

const withMdx = createMDX();
const config = createMagicDocsStaticExport(site) satisfies NextConfig;

export default withMdx(config);
