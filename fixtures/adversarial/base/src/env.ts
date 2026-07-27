// EXPECT: NO no-restricted-properties here — **/env.ts is the sanctioned place
// to read process.env per the base preset's override.
export const apiKey = process.env["API_KEY"];
