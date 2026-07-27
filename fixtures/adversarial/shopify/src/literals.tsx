const Trans = ({ children }: { children: string }) => <span>{children}</span>;

/** Reported: copy that can never be translated. */
export const Banner = () => <div>Hardcoded copy</div>;

/** NOT reported: listed in `allowedStrings`. */
export const Dot = () => <span>·</span>;

/**
 * NOT reported: `elementOverrides` exempts it. The gotcha is that the exemption
 * needs `allowElement: true` — `{ noStrings: false }` reads like it should work
 * and silently does nothing.
 */
export const Greeting = () => <Trans>Hello</Trans>;

/** NOT reported: `ignoreProps: true` keeps the rule on children only. */
export const Labelled = () => <div aria-label="Close">{null}</div>;
