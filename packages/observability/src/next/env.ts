/**
 * Server-side env for a Next app.
 *
 * `POSTHOG_KEY` is read first so a server can be pointed at a different project
 * than the browser, but `NEXT_PUBLIC_POSTHOG_KEY` is the fallback because the
 * overwhelmingly common case is one project for both, and PostHog's own Next
 * guide uses the public token on the server for exactly that reason.
 */
export const nextEnvKey = (): string | undefined =>
  process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;

export const nextEnvHost = (): string | undefined =>
  process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST;

/**
 * `onRequestError` also fires on the edge runtime, where `posthog-node` cannot
 * read the file system to symbolicate. PostHog's guide gates on this; so do we.
 */
export const isNodeRuntime = (): boolean =>
  process.env.NEXT_RUNTIME === undefined ||
  process.env.NEXT_RUNTIME === "nodejs";
