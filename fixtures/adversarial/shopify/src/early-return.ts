const log = (message: string) => message;

/** Reported: the whole body is one `if`, and there are two statements in it. */
export const handle = (ok: boolean) => {
  if (ok) {
    log("one");
    log("two");
  }
};

/**
 * Reported at `maximumStatements: 0`: a braceless *expression* consequent is
 * still a body wrapped in a condition.
 */
export const shout = (ok: boolean) => {
  if (ok) log("hi");
};

/**
 * NOT reported, and this is the fidelity fix — a braceless `return` or `throw`
 * is already the guard clause the rule asks for. The earlier port inverted it
 * into itself.
 */
export const bail = (done: boolean) => {
  if (done) return;
};

export const rethrow = (bad: boolean) => {
  if (bad) throw new Error("bad");
};
