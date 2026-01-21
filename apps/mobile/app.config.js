/**
 * Expo App Configuration
 * @see https://docs.expo.dev/workflow/configuration/
 */

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'TomIA',
  slug: 'tom-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'tomia',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'fr.tomia.mobile',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'fr.tomia.mobile',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router', 'expo-font', 'expo-secure-store', 'expo-dev-client'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'a3296e6c-a560-4d2e-8917-e3ff11de5dae',
    },
  },
};

export default config;
