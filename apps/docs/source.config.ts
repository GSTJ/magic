import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { magicDocsLlmMdxOptions } from "magic-docs/llms";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: magicDocsLlmMdxOptions,
    },
  },
});

export default defineConfig();
