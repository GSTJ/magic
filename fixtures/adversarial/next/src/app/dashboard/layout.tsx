// The other half of the trap: the obvious fix for an anonymous default export
// is a named function declaration, which trips
// `react/function-component-definition` (arrow-function only). Between the two
// rules no page shape passed.
export default function Layout() {
  return <section>layout</section>;
}
