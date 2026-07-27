// `unicorn/no-array-reverse` autofixed this to `arr.toReversed()`, which
// `magic-tsconfig`'s own `lib: ["ES2022"]` cannot compile and Hermes does not
// reliably have. Off in the preset, alongside `unicorn/no-array-sort`.
export const flip = (values: number[]): number[] => [...values].reverse();
