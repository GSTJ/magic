import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { distinctIdFromCookieHeader } from "../dist/next/cookie.js";

const cookieFor = (distinctId) =>
  `ph_phc_abc123_posthog=${encodeURIComponent(
    JSON.stringify({ distinct_id: distinctId, $sesid: [1, "a", 2] }),
  )}`;

describe("distinctIdFromCookieHeader", () => {
  it("reads distinct_id out of PostHog's cookie", () => {
    assert.equal(distinctIdFromCookieHeader(cookieFor("user-42")), "user-42");
  });

  it("finds it among other cookies", () => {
    const header = `theme=dark; ${cookieFor("user-42")}; session=abc`;
    assert.equal(distinctIdFromCookieHeader(header), "user-42");
  });

  it("skips a long cookie name with repeated PostHog prefixes", () => {
    const decoy = `${"ph_phc_".repeat(50_000)}nope=value`;
    assert.equal(
      distinctIdFromCookieHeader(`${decoy}; ${cookieFor("user-42")}`),
      "user-42",
    );
  });

  it("accepts the array form Node hands over for repeated headers", () => {
    assert.equal(
      distinctIdFromCookieHeader(["theme=dark", cookieFor("user-42")]),
      "user-42",
    );
  });

  it("returns null when the header is missing", () => {
    assert.equal(distinctIdFromCookieHeader(undefined), null);
    assert.equal(distinctIdFromCookieHeader(null), null);
    assert.equal(distinctIdFromCookieHeader(""), null);
  });

  it("returns null when there is no PostHog cookie", () => {
    assert.equal(distinctIdFromCookieHeader("theme=dark; session=abc"), null);
  });

  it("returns null rather than throwing on a corrupted payload", () => {
    assert.equal(
      distinctIdFromCookieHeader("ph_phc_abc123_posthog=not%20json"),
      null,
    );
    assert.equal(
      distinctIdFromCookieHeader("ph_phc_abc123_posthog=%7B%22a%22%3A1%7D"),
      null,
    );
  });

  it("returns null when distinct_id is present but not a usable string", () => {
    const encoded = encodeURIComponent(JSON.stringify({ distinct_id: 7 }));
    assert.equal(
      distinctIdFromCookieHeader(`ph_phc_abc123_posthog=${encoded}`),
      null,
    );

    const blank = encodeURIComponent(JSON.stringify({ distinct_id: "" }));
    assert.equal(
      distinctIdFromCookieHeader(`ph_phc_abc123_posthog=${blank}`),
      null,
    );
  });
});
