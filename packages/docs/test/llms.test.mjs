import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

const packageRoot = join(import.meta.dirname, "..");
const { defineMagicDocs } = await import(join(packageRoot, "dist", "index.js"));
const llms = await import(join(packageRoot, "dist", "llms.js"));

const site = defineMagicDocs({
  name: "Magic Modal",
  description: "Modal docs.",
  siteUrl: "https://gstj.github.io/react-native-magic-modal",
  repository: "https://github.com/GSTJ/react-native-magic-modal",
});

const generatedDoc = {
  id: "type-table-types.ts-ModalProps",
  name: "ModalProps",
  description: "Options for a modal.",
  entries: [
    {
      name: "duration",
      description: "Animation duration.\nIn milliseconds.",
      type: "number | `auto`",
      simplifiedType: "number | `auto`",
      tags: [{ name: "default", text: "300" }],
      required: false,
      deprecated: false,
    },
    {
      name: "visible",
      description: "Whether the modal is visible.",
      type: "boolean",
      simplifiedType: "boolean",
      tags: [],
      required: true,
      deprecated: true,
    },
  ],
};

const placeholder = `\0${JSON.stringify({
  name: "TypeTable",
  children: "",
  attributes: {
    type: {
      type: "mdxJsxAttributeValueExpression",
      value: JSON.stringify(generatedDoc, null, 2),
      data: { estree: { type: "Program", body: ["deliberately huge"] } },
    },
  },
})}\0`;

describe("agent-readable generated API reference", () => {
  it("preserves TypeTable as a build-time placeholder", () => {
    assert.deepEqual(llms.magicDocsLlmMdxOptions, {
      mdxAsPlaceholder: ["TypeTable"],
    });
  });

  it("renders useful Markdown without leaking ESTree", async () => {
    const markdown = await llms.renderMagicDocsLlmMarkdown(placeholder);

    assert.match(markdown, /^### ModalProps/);
    assert.match(
      markdown,
      /`duration`: `number \| \\`auto\\`` \(optional, default: 300\)/,
    );
    assert.match(markdown, /Animation duration\. In milliseconds\./);
    assert.match(markdown, /`visible`: `boolean` \(required, deprecated\)/);
    assert.doesNotMatch(markdown, /estree|deliberately huge|Program/);
  });

  it("creates a canonical page and prefixes llms.txt links", async () => {
    const page = await llms.createMagicDocsLlmPage(site, {
      title: "ModalProps",
      description: "The complete modal contract.",
      url: "/types/ModalProps",
      processedMarkdown: placeholder,
    });

    assert.match(
      page,
      /^# ModalProps \(https:\/\/gstj\.github\.io\/react-native-magic-modal\/types\/ModalProps\)/,
    );
    assert.match(page, /> The complete modal contract\./);

    assert.equal(
      llms.prefixMagicDocsLlmLinks(
        site,
        "- [ModalProps](/types/ModalProps)\n- [External](https://example.com)",
      ),
      "- [ModalProps](/react-native-magic-modal/types/ModalProps)\n- [External](https://example.com)",
    );
  });
});
