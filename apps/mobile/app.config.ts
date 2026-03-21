/**
 * Expo App Configuration (TypeScript)
 *
 * SDK 55 — React Native 0.83, React 19.2
 *
 * @see https://docs.expo.dev/workflow/configuration/
 */

import type { ConfigContext, ExpoConfig } from 'expo/config';

const EAS_PROJECT_ID = 'a3296e6c-a560-4d2e-8917-e3ff11de5dae';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'TomIA',
  slug: 'tom-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'tomia',
  userInterfaceStyle: 'automatic',

  // iOS configuration
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'fr.tomia.mobile',
    infoPlist: {
      // Background modes for audio, notifications, and background tasks
      UIBackgroundModes: ['audio', 'remote-notification', 'processing', 'fetch'],
      // Privacy descriptions (required by App Store)
      NSCameraUsageDescription:
        "TomIA utilise la caméra pour scanner des documents et prendre des photos de devoirs.",
      NSMicrophoneUsageDescription:
        "TomIA utilise le microphone pour la dictée vocale et les conversations audio.",
      NSPhotoLibraryUsageDescription:
        "TomIA accède à vos photos pour importer des images de devoirs.",
    },
  },

  // Android configuration
  android: {
    package: 'fr.tomia.mobile',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    // Edge-to-edge is mandatory in SDK 55 (no opt-in needed)
    // Explicit permissions
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'READ_MEDIA_IMAGES',       // Android 13+ (replaces READ_EXTERNAL_STORAGE)
      'READ_MEDIA_VIDEO',        // Android 13+
      'VIBRATE',
      'POST_NOTIFICATIONS',
      'ACCESS_NETWORK_STATE',
      'INTERNET',
    ],
  },

  // Web configuration
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },

  // Plugins configuration
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-dev-client',
    [
      'expo-camera',
      {
        cameraPermission:
          'TomIA a besoin de la caméra pour scanner des documents.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'TomIA accède à vos photos pour importer des images de devoirs.',
        cameraPermission:
          'TomIA utilise la caméra pour prendre des photos de devoirs.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission:
          'TomIA utilise le microphone pour la dictée vocale.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#3833DD',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#ffffff',
        image: './assets/splash-icon.png',
        imageWidth: 200,
        dark: {
          backgroundColor: '#0c0a09',
          image: './assets/splash-icon.png',
        },
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          usesCleartextTraffic: false,
        },
        ios: {
          deploymentTarget: '15.1',
        },
      },
    ],
    'expo-background-task',
    'expo-updates',
    '@react-native-google-signin/google-signin',
  ],

  // EAS Updates configuration
  // fingerprint policy for production (auto-detects native changes, prevents incompatible OTA updates)
  // Static version for dev/preview to avoid Windows/Linux fingerprint divergence in pnpm monorepo
  runtimeVersion:
    process.env.APP_ENV === 'production'
      ? { policy: 'fingerprint' as const }
      : '1.0.0-dev',
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    // Enable bsdiff patch support for smaller OTA updates (Hermes bytecode diffing)
    // @see https://docs.expo.dev/eas-update/bundle-diffing/
    enableBsdiffPatchSupport: true,
  },

  experiments: {
    typedRoutes: true,
    // reactCompiler disabled — incompatible with Expo Router (expo#35100)
  },

  // Extra configuration
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
});
