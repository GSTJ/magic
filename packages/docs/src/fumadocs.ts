import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared";

import { npmPackageUrl, type MagicDocsSite } from "./config.ts";

export type MagicDocsLayoutOptions = {
  /** Additional links appended after the standard npm shortcut. */
  links?: LinkItemType[];
  /** Override the title link without changing the Fumadocs source base URL. */
  homeUrl?: string;
  /** Hide the npm shortcut while retaining `packageName` in the site contract. */
  showPackageLink?: boolean;
};

/**
 * Shared, serializable layout options for the classic Fumadocs DocsLayout.
 * Classic is intentional: it keeps permanent navigation and TOC affordances
 * while the theme supplies the polished visual layer.
 */
export const createMagicDocsLayout = (
  site: MagicDocsSite,
  options: MagicDocsLayoutOptions = {},
): BaseLayoutProps => {
  const packageUrl = npmPackageUrl(site);
  const packageLink: LinkItemType[] =
    packageUrl !== undefined && options.showPackageLink !== false
      ? [
          {
            type: "button",
            text: "npm",
            url: packageUrl,
            external: true,
            secondary: true,
          },
        ]
      : [];

  return {
    githubUrl: site.repository,
    nav: {
      title: site.name,
      url: options.homeUrl ?? site.docsPath,
      transparentMode: "top",
    },
    links: [...packageLink, ...(options.links ?? [])],
    themeSwitch: { enabled: true },
    searchToggle: { enabled: true },
  };
};
