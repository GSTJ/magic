/**
 * Expo env, read literally so `babel-preset-expo` can inline it.
 *
 * Metro runs the Expo Babel preset over `node_modules` too, so
 * `process.env.EXPO_PUBLIC_POSTHOG_KEY` written out like this is substituted
 * even from inside a published package. Anything computed is not.
 */
export const expoEnvKey = (): string | undefined =>
  typeof process === "undefined"
    ? undefined
    : process.env.EXPO_PUBLIC_POSTHOG_KEY;

export const expoEnvHost = (): string | undefined =>
  typeof process === "undefined"
    ? undefined
    : process.env.EXPO_PUBLIC_POSTHOG_HOST;
