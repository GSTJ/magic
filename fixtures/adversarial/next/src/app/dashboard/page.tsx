// The idiomatic App Router page: an anonymous default-exported arrow. Trips
// `import/no-anonymous-default-export` unless the App Router override exempts
// it.
export default async () => {
  await Promise.resolve();
  return <main>dashboard</main>;
};
