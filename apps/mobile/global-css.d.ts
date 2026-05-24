// TypeScript 6 requires explicit module declarations for non-code side-effect
// imports. `import '../global.css'` (used by NativeWind + Tailwind via Metro
// CSS transformer) had no type declaration in TS 5, which TS 5 tolerated but
// TS 6 rejects with TS2882. This shim makes the import statically typeable
// without changing any runtime behaviour (the transformer still handles the
// actual CSS).
declare module '*.css';
