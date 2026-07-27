// `env: { browser: true }` and `globals: { __DEV__: "readonly" }` are what make
// these two read-only. Without them `no-global-assign` — an `error` rule in
// every variant — says nothing at all.
document = 1;
__DEV__ = false;

export const leaked = [document, __DEV__];
