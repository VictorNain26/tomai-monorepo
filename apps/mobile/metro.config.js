// Metro config for Expo SDK 55 monorepo
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports for better-auth compatibility
// @see https://www.better-auth.com/docs/integrations/expo
config.resolver.unstable_enablePackageExports = true;

// expo-sqlite web support (alpha)
// @see https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = withNativewind(config);
