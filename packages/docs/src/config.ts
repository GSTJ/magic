const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export type MagicDocsConfig = {
  /** Product/package name shown in navigation and metadata. */
  name: string;
  /** One useful sentence for search results and social previews. */
  description: string;
  /** Canonical deployed URL, including a GitHub Pages project path if present. */
  siteUrl: string;
  /** Canonical GitHub repository URL. */
  repository: string;
  /** npm package name. Omit for packages that are not published to npm. */
  packageName?: string;
  /** Route handled by Fumadocs inside the application. */
  docsPath?: string;
  /** Branch used by "edit/view source" links. */
  defaultBranch?: string;
};

export type MagicDocsSite = Readonly<{
  name: string;
  description: string;
  siteUrl: string;
  repository: string;
  packageName?: string;
  docsPath: string;
  defaultBranch: string;
}>;

const nonEmpty = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TypeError(`magic-docs: ${field} must not be empty`);
  }
  return trimmed;
};

const webUrl = (value: string, field: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(nonEmpty(value, field));
  } catch {
    throw new TypeError(`magic-docs: ${field} must be an absolute HTTP(S) URL`);
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new TypeError(`magic-docs: ${field} must be an absolute HTTP(S) URL`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError(
      `magic-docs: ${field} must not contain credentials, a query, or a hash`,
    );
  }
  return parsed;
};

const withoutTrailingSlash = (url: URL): string => {
  const value = url.toString();
  return url.pathname === "/"
    ? value.replace(/\/$/, "")
    : value.replace(/\/+$/, "");
};

const routePath = (value: string | undefined): string => {
  if (value === undefined || value === "/") return "/";

  const path = nonEmpty(value, "docsPath");
  if (!path.startsWith("/") || path.endsWith("/")) {
    throw new TypeError(
      "magic-docs: docsPath must start with / and must not end with /",
    );
  }
  if (path.includes("?") || path.includes("#") || path.includes("//")) {
    throw new TypeError(
      "magic-docs: docsPath must be a clean application route",
    );
  }
  return path;
};

const githubRepository = (value: string): string => {
  const url = webUrl(value, "repository");
  const segments = url.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);

  if (url.hostname !== "github.com" || segments.length !== 2) {
    throw new TypeError(
      "magic-docs: repository must be a canonical github.com/owner/repo URL",
    );
  }

  url.pathname = `/${segments.join("/")}`;
  return withoutTrailingSlash(url);
};

/**
 * Validate once and pass the resolved object to every other preset helper.
 * Failing during config evaluation is much friendlier than shipping broken
 * canonical, source, or GitHub Pages links.
 */
export const defineMagicDocs = (config: MagicDocsConfig): MagicDocsSite => {
  const site = {
    name: nonEmpty(config.name, "name"),
    description: nonEmpty(config.description, "description"),
    siteUrl: withoutTrailingSlash(webUrl(config.siteUrl, "siteUrl")),
    repository: githubRepository(config.repository),
    ...(config.packageName === undefined
      ? {}
      : { packageName: nonEmpty(config.packageName, "packageName") }),
    docsPath: routePath(config.docsPath),
    defaultBranch: nonEmpty(config.defaultBranch ?? "main", "defaultBranch"),
  };

  return Object.freeze(site);
};

export const npmPackageUrl = (site: MagicDocsSite): string | undefined =>
  site.packageName === undefined
    ? undefined
    : `https://www.npmjs.com/package/${encodeURIComponent(site.packageName)}`;

const encodePath = (path: string): string =>
  path.split("/").filter(Boolean).map(encodeURIComponent).join("/");

export const repositoryFileUrl = (
  site: MagicDocsSite,
  path: string,
): string => {
  const cleanPath = encodePath(nonEmpty(path, "repository file path"));
  if (cleanPath.length === 0) {
    throw new TypeError(
      "magic-docs: repository file path must point to a file",
    );
  }

  return `${site.repository}/blob/${encodeURIComponent(site.defaultBranch)}/${cleanPath}`;
};
