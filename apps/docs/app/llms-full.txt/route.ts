import { createMagicDocsLlmPage } from "magic-docs/llms";

import { site } from "@/lib/site";
import { source } from "@/lib/source";

export const revalidate = false;

export const GET = async () => {
  const pages = await Promise.all(
    source.getPages().map(async (page) =>
      createMagicDocsLlmPage(site, {
        title: page.data.title,
        description: page.data.description,
        url: page.url,
        processedMarkdown: await page.data.getText("processed"),
      }),
    ),
  );

  return new Response(pages.join("\n\n"));
};
