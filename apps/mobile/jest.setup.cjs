/* global jest, require */
/* eslint-disable @typescript-eslint/no-require-imports -- Expo Jest의 CJS 초기화는 require를 사용한다. */
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return mock;
});
jest.mock('react-native-worklets', () => ({
  ...require('react-native-worklets/src/mock'),
  scheduleOnRN: (callback, ...args) => callback(...args),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light' },
}));
