// EXPECT: NO magic(no-module-mocks) — not a test file, and the rule only
// applies to *.test/*.spec files.
declare const vi: { mock: (path: string) => void };
vi.mock("./helpers");
