/// <reference types="react-native-css/types" />

// TypeScript 6.0 enforces that side-effect imports resolve to a known module type.
// NativeWind/react-native-css transforms `*.css` imports at bundle time, so we declare
// them as side-effect-only modules here.
declare module "*.css";
