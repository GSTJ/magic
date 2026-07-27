// EXPECT: eslint(no-restricted-properties) with the custom env-module message.
export const apiKey = process.env["API_KEY"];

// EXPECT: also fires on dot access.
export const nodeEnv = process.env.NODE_ENV;
