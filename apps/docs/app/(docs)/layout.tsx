import type { ReactNode } from "react";

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { createMagicDocsLayout } from "magic-docs/fumadocs";

import { site } from "@/lib/site";
import { source } from "@/lib/source";

const Layout = ({ children }: { children: ReactNode }) => (
  <DocsLayout {...createMagicDocsLayout(site)} tree={source.getPageTree()}>
    {children}
  </DocsLayout>
);

export default Layout;
