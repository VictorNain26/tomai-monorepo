/**
 * Jest Setup File
 *
 * Mocks for Expo modules and React Native APIs.
 * @see https://docs.expo.dev/develop/unit-testing/
 */

import '@testing-library/react-native';

// Set required env vars for tests
process.env.EXPO_PUBLIC_REVENUECAT_API_KEY = 'test_key';

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

// Mock @react-native-google-signin/google-signin
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'cancelled' })),
    signOut: jest.fn(() => Promise.resolve()),
  },
  isSuccessResponse: jest.fn((res) => res?.type === 'success'),
  isCancelledResponse: jest.fn((res) => res?.type === 'cancelled'),
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[test]' })),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidNotificationPriority: { HIGH: 'high' },
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
const mockPurchases = {
  configure: jest.fn(() => Promise.resolve()),
  setLogLevel: jest.fn(),
  getCustomerInfo: jest.fn(() =>
    Promise.resolve({
      originalAppUserId: 'test-user',
      entitlements: { active: {} },
      activeSubscriptions: [],
    })
  ),
  logIn: jest.fn(() => Promise.resolve({ customerInfo: { entitlements: { active: {} } }, created: false })),
  logOut: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
  isAnonymous: jest.fn(() => Promise.resolve(true)),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
  getOfferings: jest.fn(() => Promise.resolve({ current: null, all: {} })),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
  setAttributes: jest.fn(() => Promise.resolve()),
  getAppUserID: jest.fn(() => Promise.resolve('test-user')),
};
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
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
