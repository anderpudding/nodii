/* global module */
module.exports = {
  preset: 'jest-expo',
  watchman: false,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  testMatch: ['**/*.native.test.tsx'],
  // pnpm 격리 경로와 core가 사용하는 순수 ESM 정렬 키 라이브러리를 변환한다.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|expo|@expo|standard-navigation|fractional-indexing|react-native-gesture-handler|react-native-reanimated|react-native-worklets))',
  ],
};
