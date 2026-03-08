/**
 * Jest Setup File
 *
 * Mocks for Expo modules and React Native APIs.
 * @see https://docs.expo.dev/develop/unit-testing/
 */

import '@testing-library/react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  Link: 'Link',
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }) => children,
  Gesture: {},
  GestureDetector: ({ children }) => children,
  PanGestureHandler: 'PanGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  State: {},
  Directions: {},
}));

// Mock react-native-css (NativeWind v5)
jest.mock('react-native-css', () => ({}));

// @repo/api is mocked via __mocks__/@repo/api.ts

// Mock @better-auth/expo
jest.mock('@better-auth/expo', () => ({
  expoClient: jest.fn(() => ({})),
}));

// Mock expo-camera
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
  Camera: {
    requestCameraPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'granted' })
    ),
  },
}));

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  Purchases: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(() =>
      Promise.resolve({
        entitlements: { active: {} },
        activeSubscriptions: [],
      })
    ),
    logIn: jest.fn(),
    logOut: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getOfferings: jest.fn(() =>
      Promise.resolve({
        current: null,
        all: {},
      })
    ),
  },
  LOG_LEVEL: { DEBUG: 0 },
}));

// Mock @shopify/flash-list
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return { FlashList: FlatList };
});

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const MockIcon = 'Icon';
  return new Proxy(
    {},
    {
      get: () => MockIcon,
    }
  );
});

// Silence console.warn for specific patterns (optional)
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    args[0]?.includes?.('Animated') ||
    args[0]?.includes?.('useNativeDriver')
  ) {
    return;
  }
  originalWarn(...args);
};

// Global fetch mock
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);
