/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Use fake timers to prevent TanStack Query timer leaks
  fakeTimers: {
    enableGlobally: true,
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@rn-primitives/.*|@tanstack/.*|@repo/api|@shopify/flash-list|@sentry/react-native|nativewind|tailwind-merge|clsx|class-variance-authority|lucide-react-native)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@repo/api$': '<rootDir>/__mocks__/@repo/api.ts',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.expo/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/_layout.tsx',
    '!**/node_modules/**',
  ],
  testMatch: [
    '**/__tests__/**/*.(spec|test).[jt]s?(x)',
  ],
};
