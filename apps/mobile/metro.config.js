// Metro config for Expo SDK 54+ monorepo
// Since SDK 52, Expo auto-configures monorepos - no manual watchFolders needed
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports for better-auth compatibility
// @see https://www.better-auth.com/docs/integrations/expo
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: './src/global.css' });
