const path = require('path');

module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],

  // ── Coverage ───────────────────────────────────────────────────────────────
  // Use V8 instead of Babel (default) — babel-plugin-istanbul crashes on Node 22+
  // due to a util.promisify type-check change in test-exclude. V8 coverage is
  // faster, uses no Babel instrumentation, and is fully compatible.
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    // Expo Router layout/entry files are purely declarative wiring — no logic to test
    '!src/app/_layout.tsx',
    '!src/app/index.tsx',
    '!src/app/(auth)/_layout.tsx',
    '!src/app/(tabs)/_layout.tsx',
    // Purely static: design tokens, theme primitives, TypeScript constants
    '!src/constants/**',
    '!src/theme/**',
  ],

  // ── Transform ──────────────────────────────────────────────────────────────
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  watchPathIgnorePatterns: ['<rootDir>/coverage', '<rootDir>/.maestro'],
};
