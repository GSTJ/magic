// A manual mock's filename is matched against the *package* being mocked, so
// it is not ours to kebab-case. Exempt via the `mocksFilenameCase` override,
// which every variant appends last for exactly this reason.
const asyncStorageMock = { getItem: () => null };

export default asyncStorageMock;
