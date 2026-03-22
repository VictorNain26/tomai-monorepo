// Metro config for Expo SDK 55 monorepo
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Package exports enabled by default since Expo SDK 53+
// No manual unstable_enablePackageExports needed
// @see https://github.com/better-auth/better-auth/issues/8186

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
