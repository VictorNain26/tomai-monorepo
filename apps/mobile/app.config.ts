/**
 * Expo App Configuration (TypeScript)
 *
 * Best practices 2026:
 * - TypeScript for type safety
 * - expo-build-properties for SDK versions
 * - EAS Updates with runtimeVersion
 * - Edge-to-edge Android display
 * - Explicit permissions
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
  newArchEnabled: true,

  // Splash screen configuration
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },

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

  // Navigation bar: fully transparent, no contrast scrim (SDK 54+)
  androidNavigationBar: {
    enforceContrast: false,
  },

  // Android configuration
  android: {
    package: 'fr.tomia.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    // Edge-to-edge display (Android 15+ best practice)
    edgeToEdgeEnabled: true,
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
          // SDK 54 defaults
          minSdkVersion: 24,
          // HTTPS only (staging + production are both HTTPS)
          usesCleartextTraffic: false,
        },
        ios: {
          // SDK 54 minimum iOS 15.1
          deploymentTarget: '15.1',
        },
      },
    ],
    'expo-background-task',
    'expo-updates',
    '@react-native-google-signin/google-signin',
  ],

  // EAS Updates configuration
  // fingerprint policy: auto-detects native changes, prevents incompatible OTA updates
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },

  // Experiments (SDK 54 best practices)
  experiments: {
    typedRoutes: true,
    // Resolves react/react-dom to single version in monorepo
    // Prevents mismatches between native modules and JS modules (SDK 54+)
    autolinkingModuleResolution: true,
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
