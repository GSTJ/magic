/**
 * Reading the distinct id out of PostHog's browser cookie.
 *
 * Without this, every server-side `$exception` lands on an anonymous person and
 * the session replay for the request that failed cannot be found from the
 * error. PostHog's Next guide inlines this in `instrumentation.js`; it lives
 * here instead because a regex against a cookie header is exactly the kind of
 * thing that should have a test.
 *
 * The cookie is named `ph_<project token>_posthog`, which for a real token
 * always starts `ph_phc_`.
 */
const COOKIE_PATTERN = /ph_phc_.*?_posthog=([^;]+)/;

/** Normalises the several shapes a cookie header arrives in. */
const asCookieString = (
  header: string | readonly string[] | undefined | null,
): string | null => {
  if (!header) return null;
  return Array.isArray(header) ? header.join("; ") : String(header);
};

/**
 * The `distinct_id` PostHog stored in the browser, or `null` when the header is
 * missing, the cookie is absent, or its payload is not the JSON we expect.
 * Never throws — a malformed cookie must not turn a 500 into two 500s.
 */
export const distinctIdFromCookieHeader = (
  header: string | readonly string[] | undefined | null,
): string | null => {
  const cookies = asCookieString(header);
  if (cookies === null) return null;

  const match = COOKIE_PATTERN.exec(cookies);
  const encoded = match?.[1];
  if (!encoded) return null;

  try {
    const payload: unknown = JSON.parse(decodeURIComponent(encoded));
    if (
      typeof payload === "object" &&
      payload !== null &&
      "distinct_id" in payload
    ) {
      const distinctId = (payload as { distinct_id: unknown }).distinct_id;
      return typeof distinctId === "string" && distinctId !== ""
        ? distinctId
        : null;
    }
  } catch {
    return null;
  }

  return null;
};
