/**
 * `TextField` forwards its props onto an `<input>`, which is why it is listed
 * in `inputComponents`. The spread is also the documented divergence: an
 * element with a spread attribute is skipped, because `autoComplete` may well
 * be inside it.
 */
const TextField = (props: { name: string; type: string }) => (
  <input {...props} />
);

export const SignIn = () => (
  <form>
    {/* Reported: autofillable, and nobody decided what should fill it. */}
    <input name="email" type="email" />

    {/* Reported: a listed component counts as an input. */}
    <TextField name="city" type="text" />

    {/* NOT reported: the decision was made, and "off" is a valid answer. */}
    <input autoComplete="current-password" name="password" type="password" />
    <input autoComplete="off" name="code" type="text" />

    {/* NOT reported: a checkbox is not autofillable. */}
    <input name="remember" type="checkbox" />

    {/* NOT reported: computed type, so the rule cannot tell. Silence over a
        guess — upstream falls back to treating it as text. */}
    <input name="dynamic" type={String("text")} />
  </form>
);
