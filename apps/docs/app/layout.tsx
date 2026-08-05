import type { ReactNode } from "react";

import type { Metadata } from "next";

import { RootProvider } from "fumadocs-ui/provider/next";
import { createMagicDocsMetadata } from "magic-docs";

import { publicPaths, site } from "@/lib/site";

import "./global.css";

export const metadata: Metadata = createMagicDocsMetadata(site);

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <body className="flex min-h-screen flex-col">
      {/*
        The search index is a file in the export, so the dialog downloads it
        instead of calling a server. `searchApi` carries the `/magic` prefix
        that Next does not add to fetch URLs.
      */}
      <RootProvider
        search={{ options: { type: "static", api: publicPaths.searchApi } }}
      >
        {children}
      </RootProvider>
    </body>
  </html>
);

export default RootLayout;
