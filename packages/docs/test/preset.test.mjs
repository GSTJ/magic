import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const packageRoot = join(import.meta.dirname, "..");

const core = await import(join(packageRoot, "dist", "index.js"));
const fumadocs = await import(join(packageRoot, "dist", "fumadocs.js"));
const mdx = await import(join(packageRoot, "dist", "mdx.js"));
const typescript = await import(join(packageRoot, "dist", "typescript.js"));

const site = core.defineMagicDocs({
  name: "React Native Magic Modal",
  description: "A declarative modal library for React Native.",
  siteUrl: "https://gstj.github.io/react-native-magic-modal/",
  repository: "https://github.com/GSTJ/react-native-magic-modal.git",
  packageName: "react-native-magic-modal",
});

describe("site contract", () => {
  it("normalizes canonical URLs and resolves defaults", () => {
    assert.deepEqual(site, {
      name: "React Native Magic Modal",
      description: "A declarative modal library for React Native.",
      siteUrl: "https://gstj.github.io/react-native-magic-modal",
      repository: "https://github.com/GSTJ/react-native-magic-modal",
      packageName: "react-native-magic-modal",
      docsPath: "/",
      defaultBranch: "main",
    });
    assert.ok(Object.isFrozen(site));
  });

  it("fails early on links that would produce a broken deployment", () => {
    assert.throws(
      () =>
        core.defineMagicDocs({
          name: "Package",
          description: "Description",
          siteUrl: "/relative",
          repository: "https://github.com/GSTJ/package",
        }),
      /absolute HTTP/,
    );
    assert.throws(
      () =>
        core.defineMagicDocs({
          name: "Package",
          description: "Description",
          siteUrl: "https://example.com",
          repository: "https://gitlab.com/GSTJ/package",
        }),
      /canonical github/,
    );
    assert.throws(
      () =>
        core.defineMagicDocs({
          name: "Package",
          description: "Description",
          siteUrl: "https://example.com",
          repository: "https://github.com/GSTJ/package",
          docsPath: "docs",
        }),
      /must start with/,
    );
  });
});

describe("public paths", () => {
  it("configures Next static export with basePath but no assetPrefix", () => {
    assert.deepEqual(core.createMagicDocsStaticExport(site), {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
      basePath: "/react-native-magic-modal",
    });
    assert.equal(
      "assetPrefix" in core.createMagicDocsStaticExport(site),
      false,
    );
  });

  it("prefixes fetch, Markdown, LLM, and canonical URLs exactly once", () => {
    const paths = core.createMagicDocsPublicPaths(site);

    assert.equal(paths.basePath, "/react-native-magic-modal");
    assert.equal(paths.searchApi, "/react-native-magic-modal/api/search");
    assert.equal(paths.llms, "/react-native-magic-modal/llms.txt");
    assert.equal(paths.llmsFull, "/react-native-magic-modal/llms-full.txt");
    assert.equal(
      paths.markdown("/types/ModalProps"),
      "/react-native-magic-modal/types/ModalProps.md",
    );
    assert.equal(
      paths.path("/react-native-magic-modal/api/search"),
      "/react-native-magic-modal/api/search",
      "prefixing must be idempotent",
    );
    assert.equal(
      paths.url("/types/ModalProps"),
      "https://gstj.github.io/react-native-magic-modal/types/ModalProps",
    );
  });

  it("keeps root/custom-domain deployments unprefixed", () => {
    const custom = core.defineMagicDocs({
      name: "Package",
      description: "Description",
      siteUrl: "https://docs.example.com",
      repository: "https://github.com/GSTJ/package",
    });

    assert.equal(core.magicDocsBasePath(custom), "");
    assert.equal(core.magicDocsPath(custom, "/api/search"), "/api/search");
    assert.equal(core.magicDocsUrl(custom, "/"), "https://docs.example.com");
    assert.equal(core.createMagicDocsStaticExport(custom).basePath, undefined);
  });
});

describe("metadata and repository links", () => {
  it("uses explicit canonical and Open Graph URLs", () => {
    const metadata = core.createMagicDocsMetadata(site);

    assert.equal(metadata.metadataBase.href, "https://gstj.github.io/");
    assert.equal(metadata.alternates.canonical, site.siteUrl);
    assert.equal(metadata.openGraph.url, site.siteUrl);
    assert.equal(metadata.twitter.card, "summary_large_image");
  });

  it("builds encoded source and npm links", () => {
    assert.equal(
      core.repositoryFileUrl(site, "content/docs/get started.mdx"),
      "https://github.com/GSTJ/react-native-magic-modal/blob/main/content/docs/get%20started.mdx",
    );
    assert.equal(
      core.npmPackageUrl(site),
      "https://www.npmjs.com/package/react-native-magic-modal",
    );
  });
});

describe("Fumadocs presets", () => {
  it("keeps discoverability controls on by default", () => {
    const layout = fumadocs.createMagicDocsLayout(site);

    assert.equal(layout.githubUrl, site.repository);
    assert.deepEqual(layout.nav, {
      title: site.name,
      url: "/",
      transparentMode: "top",
    });
    assert.deepEqual(layout.themeSwitch, { enabled: true });
    assert.deepEqual(layout.searchToggle, { enabled: true });
    assert.equal(layout.links[0].text, "npm");
    assert.equal(layout.links[0].type, "button");
  });

  it("ships one CSS entry with upstream preset and GSTJ tokens", () => {
    const css = readFileSync(join(packageRoot, "theme.css"), "utf8");

    assert.match(css, /@import "fumadocs-ui\/css\/neutral\.css"/);
    assert.match(css, /@import "fumadocs-ui\/css\/preset\.css"/);
    assert.match(css, /--color-fd-primary:/);
    assert.match(css, /#nd-sidebar/);
    assert.match(css, /prefers-reduced-motion/);
  });

  it("adds the rich components and build-time TypeScript plugin", () => {
    const components = mdx.createMagicDocsMdxComponents();
    const typePreset = typescript.createMagicDocsTypeScript();

    for (const name of ["Accordion", "Files", "Steps", "Tabs", "TypeTable"]) {
      assert.equal(
        typeof components[name],
        "function",
        `${name} MDX component`,
      );
    }
    assert.equal(typeof typePreset.generator.generateTypeTable, "function");
    assert.equal(typeof typePreset.remarkPlugin[0], "function");
    assert.equal(typePreset.remarkPlugin[1].generator, typePreset.generator);
  });
});
