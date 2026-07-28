/**
 * Server env. No prefix, because nothing here is exposed to a client bundle.
 */
export const nodeEnvKey = (): string | undefined => process.env.POSTHOG_KEY;

export const nodeEnvHost = (): string | undefined => process.env.POSTHOG_HOST;
