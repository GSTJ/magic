import type { CSSProperties, ReactNode } from "react";

import { DocsLandingEffects } from "@/registry/default/docs-landing/docs-landing-effects";
import { InstallCommand } from "@/registry/default/docs-landing/install-command";

import styles from "./docs-landing.module.css";

export type DocsLink = {
  href: string;
  label: string;
  external?: boolean;
};

export type DocsLandingProps = {
  children: ReactNode;
  name: string;
  brandMark?: ReactNode;
  className?: string;
  footerLinks?: readonly DocsLink[];
  footerNote?: ReactNode;
  homeHref?: string;
  navigation?: readonly DocsLink[];
  repository?: DocsLink;
  style?: CSSProperties;
  version?: string;
};

export type DocsHeroProps = {
  actions?: readonly (DocsLink & { kind?: "primary" | "secondary" })[];
  description: ReactNode;
  eyebrow: ReactNode;
  id?: string;
  installCommand?: string;
  nextHref?: string;
  nextLabel?: string;
  title: ReactNode;
  visual?: ReactNode;
};

export type DocsStat = {
  label: string;
  value: string;
  href?: string;
};

export type DocsSectionProps = {
  children?: ReactNode;
  action?: DocsLink;
  description?: ReactNode;
  eyebrow: ReactNode;
  id?: string;
  index?: string;
  layout?: "copy-first" | "stacked" | "visual-first";
  title: ReactNode;
  tone?: "blue" | "coral" | "dark" | "lime" | "paper";
};

export type DocsTimelineItem = {
  date: string;
  description: ReactNode;
  href?: string;
  title: string;
};

const classes = (...values: (false | string | undefined)[]) =>
  values.filter(Boolean).join(" ");

const linkProps = (link: DocsLink) =>
  link.external
    ? ({ rel: "noreferrer", target: "_blank" } as const)
    : undefined;

const DocsActionLink = ({
  kind = "secondary",
  link,
}: {
  kind?: "primary" | "secondary";
  link: DocsLink;
}) => (
  <a
    className={kind === "primary" ? styles.primaryAction : styles.textAction}
    href={link.href}
    {...linkProps(link)}
  >
    {link.label}
    <span aria-hidden="true" className={styles.actionLine} />
  </a>
);

export const DocsLanding = ({
  brandMark,
  children,
  className,
  footerLinks = [],
  footerNote,
  homeHref = "/",
  name,
  navigation = [],
  repository,
  style,
  version,
}: DocsLandingProps) => (
  <DocsLandingEffects className={classes(styles.root, className)} style={style}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a aria-label={`${name} home`} className={styles.brand} href={homeHref}>
          {brandMark ? (
            <span className={styles.brandMark}>{brandMark}</span>
          ) : null}
          <span>{name}</span>
          {version ? <code>{version}</code> : null}
        </a>

        <nav aria-label="Primary navigation" className={styles.navigation}>
          {navigation.map((link) => (
            <a
              href={link.href}
              key={`${link.href}-${link.label}`}
              {...linkProps(link)}
            >
              {link.label}
            </a>
          ))}
          {repository ? (
            <a
              className={styles.repositoryLink}
              href={repository.href}
              {...linkProps({ ...repository, external: true })}
            >
              {repository.label}
            </a>
          ) : null}
        </nav>
      </div>
    </header>

    {children}

    <footer className={styles.footer}>
      <div>
        <a className={styles.brand} href={homeHref}>
          {brandMark ? (
            <span className={styles.brandMark}>{brandMark}</span>
          ) : null}
          <span>{name}</span>
        </a>
        {footerNote ? <p>{footerNote}</p> : null}
      </div>
      {footerLinks.length > 0 ? (
        <nav aria-label="Footer navigation">
          {footerLinks.map((link) => (
            <a
              href={link.href}
              key={`${link.href}-${link.label}`}
              {...linkProps(link)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      ) : null}
    </footer>
  </DocsLandingEffects>
);

export const DocsHero = ({
  actions = [],
  description,
  eyebrow,
  id = "overview",
  installCommand,
  nextHref,
  nextLabel = "Next section",
  title,
  visual,
}: DocsHeroProps) => (
  <section
    className={styles.hero}
    data-docs-hero
    data-has-visual={visual ? "true" : "false"}
    id={id}
  >
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow} data-docs-hero-reveal>
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <h1 data-docs-hero-reveal>{title}</h1>
      <div className={styles.heroDescription} data-docs-hero-reveal>
        {description}
      </div>
      {actions.length > 0 ? (
        <div className={styles.heroActions} data-docs-hero-reveal>
          {actions.map((action) => (
            <DocsActionLink
              kind={action.kind}
              key={`${action.href}-${action.label}`}
              link={action}
            />
          ))}
        </div>
      ) : null}
      {installCommand ? (
        <div data-docs-hero-reveal>
          <InstallCommand command={installCommand} />
        </div>
      ) : null}
    </div>

    {visual ? (
      <div className={styles.heroVisual} data-docs-float="14" data-docs-visual>
        {visual}
      </div>
    ) : null}

    {nextHref ? (
      <a className={styles.scrollCue} href={nextHref}>
        <span>{nextLabel}</span>
        <span aria-hidden="true" className={styles.scrollGlyph} />
      </a>
    ) : null}
  </section>
);

export const DocsStatStrip = ({
  ariaLabel = "Project activity",
  items,
}: {
  ariaLabel?: string;
  items: readonly DocsStat[];
}) => (
  <section
    aria-label={ariaLabel}
    className={styles.statStrip}
    data-docs-section
  >
    <ul>
      {items.map((item) => (
        <li data-docs-reveal key={item.label}>
          {item.href ? (
            <a href={item.href} rel="noreferrer" target="_blank">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </a>
          ) : (
            <>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </>
          )}
        </li>
      ))}
    </ul>
    <span aria-hidden="true" data-docs-rule />
  </section>
);

export const DocsSection = ({
  action,
  children,
  description,
  eyebrow,
  id,
  index,
  layout = "copy-first",
  title,
  tone = "dark",
}: DocsSectionProps) => (
  <section
    className={styles.section}
    data-docs-section
    data-layout={layout}
    data-tone={tone}
    id={id}
  >
    <div className={styles.sectionCopy} data-docs-reveal>
      <div className={styles.sectionKicker}>
        {index ? <strong>{index}</strong> : null}
        <span>{eyebrow}</span>
      </div>
      <h2>{title}</h2>
      {description ? (
        <div className={styles.sectionDescription}>{description}</div>
      ) : null}
      {action ? <DocsActionLink link={action} /> : null}
    </div>

    {children ? (
      <div className={styles.sectionVisual} data-docs-reveal>
        {children}
      </div>
    ) : null}
    <span aria-hidden="true" data-docs-rule />
  </section>
);

export const DocsDemoFrame = ({
  children,
  label,
  meta,
}: {
  children: ReactNode;
  label: string;
  meta?: ReactNode;
}) => (
  <div className={styles.demoFrame} data-docs-float="8">
    <header>
      <span>{label}</span>
      {meta ? <span>{meta}</span> : null}
    </header>
    <div className={styles.demoBody}>{children}</div>
  </div>
);

export const DocsTimeline = ({
  description,
  eyebrow,
  id,
  items,
  title,
}: {
  description?: ReactNode;
  eyebrow: ReactNode;
  id?: string;
  items: readonly DocsTimelineItem[];
  title: ReactNode;
}) => (
  <section className={styles.timeline} data-docs-section id={id}>
    <header data-docs-reveal>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <div>{description}</div> : null}
    </header>
    <ol>
      {items.map((item) => (
        <li data-docs-reveal key={`${item.date}-${item.title}`}>
          {item.href ? (
            <a href={item.href} rel="noreferrer" target="_blank">
              <time>{item.date}</time>
              <strong>{item.title}</strong>
              <div>{item.description}</div>
            </a>
          ) : (
            <div>
              <time>{item.date}</time>
              <strong>{item.title}</strong>
              <div>{item.description}</div>
            </div>
          )}
        </li>
      ))}
    </ol>
    <span aria-hidden="true" data-docs-rule />
  </section>
);

export const DocsFinalCta = ({
  action,
  decoration,
  description,
  eyebrow,
  installCommand,
  title,
}: {
  action: DocsLink;
  decoration?: ReactNode;
  description: ReactNode;
  eyebrow: ReactNode;
  installCommand?: string;
  title: ReactNode;
}) => (
  <section className={styles.finalCta} data-docs-section>
    <div className={styles.finalCopy} data-docs-reveal>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <div>{description}</div>
      <div className={styles.finalActions}>
        <DocsActionLink kind="primary" link={action} />
        {installCommand ? (
          <InstallCommand command={installCommand} compact />
        ) : null}
      </div>
    </div>
    {decoration ? (
      <div
        aria-hidden="true"
        className={styles.finalDecoration}
        data-docs-float="10"
        data-docs-reveal
      >
        {decoration}
      </div>
    ) : null}
    <span aria-hidden="true" data-docs-rule />
  </section>
);

export { InstallCommand };
