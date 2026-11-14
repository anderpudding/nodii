import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { registerPushToken, removePushToken, type NodiiClient } from '@nodii/api';
import { foregroundPresentation, syncPushToken, withPushTokenCleanup } from '../../../lib/push';
import { PushDeviceSettings, PushPermissionCard } from './PushPermission';
import { usePushResponse } from './usePush';

jest.mock('expo-constants', () => ({
  expoConfig: { version: '0.2.0', extra: { eas: { projectId: 'project' } } },
}));
jest.mock('@nodii/api', () => ({ registerPushToken: jest.fn(), removePushToken: jest.fn() }));
jest.mock('../../components/Toast', () => ({ useToast: () => jest.fn() }));

const client = {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) },
} as unknown as NodiiClient;
const granted = { granted: true, status: 'granted' } as Notifications.NotificationPermissionsStatus;
const denied = { granted: false, status: 'denied' } as Notifications.NotificationPermissionsStatus;
const undetermined = {
  granted: false,
  status: 'undetermined',
} as Notifications.NotificationPermissionsStatus;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(registerPushToken).mockResolvedValue(undefined);
  jest.mocked(removePushToken).mockResolvedValue(undefined);
  await AsyncStorage.clear();
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied);
  jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(null);
});

test('registers the token once, then removes only that token before logout', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted);
  jest
    .mocked(Notifications.getExpoPushTokenAsync)
    .mockResolvedValue({ type: 'expo', data: 'ExpoPushToken[test]' });
  await syncPushToken(client, 'me', () => false);
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  await syncPushToken(client, 'me', () => true);
  await syncPushToken(client, 'me', () => true);
  expect(registerPushToken).toHaveBeenCalledTimes(1);
  expect(registerPushToken).toHaveBeenCalledWith(
    client,
    expect.objectContaining({
      token: 'ExpoPushToken[test]',
      userId: 'me',
      locale: 'ko',
      version: '0.2.0',
    }),
  );
  const fail = jest.fn();
  await withPushTokenCleanup(client, 'me', fail, async () => {
    expect(removePushToken).toHaveBeenCalledWith(client, 'me', 'ExpoPushToken[test]');
  });
  expect(fail).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('nodii:registered-push-token')).toBeNull();
});

test('requests permissions only after tapping the card and opens device settings when denied', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(undetermined);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(denied);
  const card = render(<PushPermissionCard client={client} me="me" />);
  const enable = await card.findByRole('button', { name: '알림 켜기' });
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  fireEvent.press(enable);
  await waitFor(() => expect(card.queryByRole('button', { name: '알림 켜기' })).toBeNull());
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: false,
    },
  });
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied);
  const link = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const settings = render(<PushDeviceSettings />);
  fireEvent.press(await settings.findByRole('button', { name: '설정 열기' }));
  expect(link).toHaveBeenCalled();
  link.mockRestore();
});

test('reoffers the dismissed prompt only once, at seven days', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(undetermined);
  await AsyncStorage.setItem(
    'nodii:push-permission-dismissal',
    String(Date.now() - 7 * 24 * 60 * 60 * 1000),
  );
  const card = render(<PushPermissionCard client={client} me="me" />);
  fireEvent.press(await card.findByRole('button', { name: '안내 닫기' }));
  await waitFor(async () =>
    expect(await AsyncStorage.getItem('nodii:push-permission-dismissal')).toBe('done'),
  );
  expect(card.queryByRole('button', { name: '알림 켜기' })).toBeNull();
});

test('uses cold-start responses once and has no foreground banner, list, badge or sound', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue({
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { request: { identifier: 'push-1', content: { data: { notificationId: id } } } },
  } as unknown as Notifications.NotificationResponse);
  const open = jest.fn();
  function Response({ enabled }: { enabled: boolean }) {
    usePushResponse(enabled, open);
    return null;
  }
  const screen = render(<Response enabled={false} />);
  expect(open).not.toHaveBeenCalled();
  screen.rerender(<Response enabled />);
  expect(open).toHaveBeenCalledWith(id);
  screen.rerender(<Response enabled={false} />);
  screen.rerender(<Response enabled />);
  expect(open).toHaveBeenCalledTimes(1);
  expect(foregroundPresentation).toEqual({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldSetBadge: false,
    shouldPlaySound: false,
  });
});
