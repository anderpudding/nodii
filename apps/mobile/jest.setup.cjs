/* global jest, require, beforeEach */
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
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageTag: 'ko-KR' }]) }));
beforeEach(() => {
  const { setLocale, setPseudoLocale } = require('@nodii/i18n');
  setLocale('ko');
  setPseudoLocale(false);
});

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'denied', granted: false })),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setBadgeCountAsync: jest.fn(async () => true),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));
