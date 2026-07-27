// EXPECT with magic/no-module-mocks ON:
//   - vi.mock fires (top-level message)
//   - jest.mock fires
//   - vi.mock inside `if` fires with the CONDITIONAL message
import { vi } from "vitest";

vi.mock("./helpers");
jest.mock("./helpers");

// eslint-disable-next-line no-undef
if (process.platform === "darwin") {
  vi.mock("./mac-helpers");
}

test("mocked", () => {
  expect(true).toBe(true);
});
