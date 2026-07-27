// EXPECT under DEFAULT preset: NO magic(no-module-mocks) — the rule is opt-in.
// The same file lives in ../optin where it MUST fire.
import { vi } from "vitest";

vi.mock("./helpers");
jest.mock("./helpers");

test("mocked", () => {
  expect(true).toBe(true);
});
