// `jest/valid-title`'s `mustNotMatch` bans titles starting with the *words*
// "should" and "it". Before the `\b` fix it banned titles starting with those
// *letters*, so a describe named after the function under test was reported.
describe("itemsToChunks", () => {
  it("returns chunks", () => {
    expect(1).toBe(1);
  });
});

describe("shouldRetry", () => {
  // EXPECT reported: starts with the word "should".
  it("should return null", () => {
    expect(1).toBe(1);
  });

  // EXPECT reported: says "correctly".
  it("parses correctly", () => {
    expect(1).toBe(1);
  });

  // EXPECT reported: ends with a full stop.
  it("parses the thing.", () => {
    expect(1).toBe(1);
  });
});
