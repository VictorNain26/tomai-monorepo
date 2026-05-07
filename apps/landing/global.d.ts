/**
 * Ambient module declarations for the landing app.
 *
 * TypeScript 6.0 enforces that side-effect imports (e.g. `import "./globals.css"`)
 * resolve to a known module type. Next.js handles CSS bundling at build time, so
 * we declare these as side-effect-only modules with no runtime exports.
 */

declare module "*.css";
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
