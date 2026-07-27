// `unicorn/catch-error-name` used to rename this binding to `error` AND rewrite
// the shorthand property key with it, turning the standard `{ cause }` chaining
// option into an unknown `{ error }` option. Nothing reports that. The preset
// now exempts `cause`.
export const run = async (work: Promise<void>): Promise<void> => {
  await work.catch((cause: unknown) => {
    throw new Error("work failed", { cause });
  });
};

export const alsoFine = (): void => {
  try {
    JSON.parse("{}");
  } catch (cause) {
    throw new Error("bad json", { cause });
  }
};
