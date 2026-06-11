/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Use fake timers to prevent TanStack Query timer leaks
  fakeTimers: {
    enableGlobally: true,
  },
  transformIgnorePatterns: [
    // Whitelist `.pnpm/` so ALL files under pnpm's content-addressable
    // store (`node_modules/.pnpm/<pkg>@<v>_<hash>/node_modules/<pkg>/...`)
    // are transformed. Filtering inside `.pnpm/` is fiddly because pnpm
    // encodes scopes as `+` and versions as `@<v>_<hash>`; we accept the
    // slightly larger transform set in exchange for a regex that works
    // on every machine. The named packages below are also whitelisted
    // directly, independent of store path (workspace symlinks resolve
    // outside `.pnpm/`). [\\\\/] matches both POSIX "/" and Windows "\".
    'node_modules[\\\\/](?!\\.pnpm[\\\\/]|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?[\\\\/].*|@expo-google-fonts[\\\\/].*|react-navigation|@react-navigation[\\\\/].*|@rn-primitives[\\\\/].*|@tanstack[\\\\/].*|@repo[\\\\/](api|tokens)|@shopify[\\\\/]flash-list|nativewind|tailwind-merge|clsx|class-variance-authority|lucide-react-native|@stablelib[\\\\/].*)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@repo/api$': '<rootDir>/__mocks__/@repo/api.ts',
    '^@repo/tokens$': '<rootDir>/../../packages/tokens/src/index.ts',
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
  // Anti-regression floor. Baseline 2026-04-21: 8.78% stmts / 8.91% lines.
  // Raise progressively as SP3-SP5 add tests for hooks, services, and stores.
  // Target 2026-Q3: 40% global / 70% on src/stores and src/lib.
  coverageThreshold: {
    global: {
      statements: 8,
      branches: 4,
      functions: 8,
      lines: 8,
    },
  },
  testMatch: [
    '**/__tests__/**/*.(spec|test).[jt]s?(x)',
  ],
};
