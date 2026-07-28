/**
 * Browser-side env, read the only way bundlers understand: literally.
 *
 * Next inlines `NEXT_PUBLIC_*` through DefinePlugin, and it does that inside
 * `node_modules` too, so this file works from a published package. Vite does
 * not populate `process.env` in the browser at all — Vite apps pass
 * `key: import.meta.env.VITE_POSTHOG_KEY` explicitly, which is why there is no
 * `import.meta` read here. A dynamic one would not be substituted anyway.
 *
 * The `typeof process` guard matters: without it, a Vite bundle that never
 * defined `process` throws a ReferenceError at import time.
 */
export const webEnvKey = (): string | undefined =>
  typeof process === "undefined"
    ? undefined
    : process.env.NEXT_PUBLIC_POSTHOG_KEY;

export const webEnvHost = (): string | undefined =>
  typeof process === "undefined"
    ? undefined
    : process.env.NEXT_PUBLIC_POSTHOG_HOST;
