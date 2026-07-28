/**
 * The bundler resolves `*.module.css` for the consumer; tsc has to be told.
 * Not part of any registry item — `registry.json` lists the files it ships,
 * and this is not one of them.
 */
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
