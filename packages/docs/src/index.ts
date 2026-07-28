import type { MagicDocsSite } from "./config.ts";

export { defineMagicDocs, npmPackageUrl, repositoryFileUrl } from "./config.ts";
export type { MagicDocsConfig, MagicDocsSite } from "./config.ts";

const applicationPath = (path: string): string => {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError(
      "magic-docs: application paths must start with exactly one /",
    );
  }
  return path;
};

/** The Next.js `basePath` implied by the canonical deployed URL. */
export const magicDocsBasePath = (site: MagicDocsSite): string => {
  const pathname = new URL(site.siteUrl).pathname.replace(/\/+$/, "");
  return pathname === "" ? "" : pathname;
};

/**
 * Prefix a path that Next cannot see (fetch URLs, copied Markdown links, and
 * route strings). Next's Link component handles `basePath` itself; arbitrary
 * strings do not.
 */
export const magicDocsPath = (site: MagicDocsSite, path: string): string => {
  const route = applicationPath(path);
  const basePath = magicDocsBasePath(site);

  if (
    basePath !== "" &&
    (route === basePath || route.startsWith(`${basePath}/`))
  ) {
    return route;
  }
  if (route === "/") return basePath || "/";
  return `${basePath}${route}`;
};

/** Resolve an application path to its public, canonical absolute URL. */
export const magicDocsUrl = (site: MagicDocsSite, path: string): string => {
  const route = applicationPath(path);
  if (route === "/") return site.siteUrl;
  return `${new URL(site.siteUrl).origin}${magicDocsPath(site, route)}`;
};

export type MagicDocsPublicPaths = {
  basePath: string;
  searchApi: string;
  llms: string;
  llmsFull: string;
  path: (applicationPath: string) => string;
  url: (applicationPath: string) => string;
  markdown: (pagePath: string, extension?: ".md" | ".mdx") => string;
};

/**
 * All public strings that need manual GitHub Pages prefixing in one object.
 * In particular, pass `searchApi` to `oramaStaticClient({ from })`.
 */
export const createMagicDocsPublicPaths = (
  site: MagicDocsSite,
): MagicDocsPublicPaths => ({
  basePath: magicDocsBasePath(site),
  searchApi: magicDocsPath(site, "/api/search"),
  llms: magicDocsPath(site, "/llms.txt"),
  llmsFull: magicDocsPath(site, "/llms-full.txt"),
  path: (path) => magicDocsPath(site, path),
  url: (path) => magicDocsUrl(site, path),
  markdown: (pagePath, extension = ".md") =>
    magicDocsPath(
      site,
      `${applicationPath(pagePath).replace(/\/$/, "")}${extension}`,
    ),
});

export type MagicDocsMetadata = {
  metadataBase: URL;
  applicationName: string;
  title: {
    default: string;
    template: string;
  };
  description: string;
  alternates: {
    canonical: string;
  };
  openGraph: {
    type: "website";
    url: string;
    siteName: string;
    title: string;
    description: string;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description: string;
  };
};

/**
 * A Next Metadata-compatible object without making `next` a dependency of the
 * reusable package.
 */
export const createMagicDocsMetadata = (
  site: MagicDocsSite,
): MagicDocsMetadata => {
  const deployed = new URL(site.siteUrl);

  return {
    metadataBase: new URL(deployed.origin),
    applicationName: site.name,
    title: {
      default: site.name,
      template: `%s · ${site.name}`,
    },
    description: site.description,
    alternates: { canonical: site.siteUrl },
    openGraph: {
      type: "website",
      url: site.siteUrl,
      siteName: site.name,
      title: site.name,
      description: site.description,
    },
    twitter: {
      card: "summary_large_image",
      title: site.name,
      description: site.description,
    },
  };
};

export type MagicDocsStaticExportConfig = {
  output: "export";
  trailingSlash: true;
  images: {
    unoptimized: true;
  };
  basePath?: string;
};

/**
 * Produce the portable part of a Next static-export config. The pathname in
 * `siteUrl` becomes `basePath`, which is exactly what a GitHub Pages project
 * site needs and is empty for a custom/root domain. Next explicitly does not
 * recommend `assetPrefix` for sub-path hosting; `basePath` handles `/_next`.
 */
export const createMagicDocsStaticExport = (
  site: MagicDocsSite,
): MagicDocsStaticExportConfig => {
  const basePath = magicDocsBasePath(site);

  return {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
    ...(basePath === "" ? {} : { basePath }),
  };
};
