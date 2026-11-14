import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { onAction } from '@tauri-apps/plugin-notification';
import {
  fetchFriendDonePushBaseline,
  fetchSocialProfile,
  subscribeNotifications,
  type NodiiClient,
} from '@nodii/api';
import {
  canShowLocalNotification,
  isLocalNotificationEvent,
  useLocalNotifications,
} from './local-notifications';

const windowMocks = vi.hoisted(() => ({
  show: vi.fn(async () => {}),
  isFocused: vi.fn(async () => true),
  setFocus: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => windowMocks }));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => true),
  invoke: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/plugin-notification', () => ({ onAction: vi.fn() }));
vi.mock('@nodii/api', () => ({
  fetchFriendDonePushBaseline: vi.fn(async () => new Map()),
  fetchSocialProfile: vi.fn(async () => ({ nickname: '민수' })),
  subscribeNotifications: vi.fn(() => () => {}),
}));

type Write = NonNullable<Parameters<typeof subscribeNotifications>[3]>;
const row: Parameters<Write>[1] = {
  id: 'push',
  actorId: 'friend',
  kind: 'friend_done',
  count: 2,
  updatedAt: '2026-01-15T12:00:00Z',
  date: '2026-01-15',
  todoId: null,
  routineId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
  localStorage.clear();
});

it('requires growth and a newer timestamp for friend completion updates', () => {
  const previous = { count: 1, updatedAt: '2026-01-15T11:00:00Z' };
  expect(isLocalNotificationEvent('UPDATE', row, previous)).toBe(true);
  expect(isLocalNotificationEvent('UPDATE', row, { ...previous, count: 2 })).toBe(false);
  expect(isLocalNotificationEvent('UPDATE', row, { ...row, count: 1 })).toBe(false);
  expect(isLocalNotificationEvent('UPDATE', row)).toBe(false);
  expect(isLocalNotificationEvent('UPDATE', { ...row, kind: 'reaction' }, previous)).toBe(false);
  expect(isLocalNotificationEvent('INSERT', { ...row, kind: 'reaction' })).toBe(true);
});

it('limits delivery in the foreground notification tab, quiet hours and the three-hour window', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  expect(canShowLocalNotification('follow', now, 'UTC', null, true)).toBe(false);
  expect(canShowLocalNotification('follow', now, 'America/Vancouver', null, false)).toBe(false);
  expect(canShowLocalNotification('friend_done', now, 'UTC', '2026-01-15T09:00:01Z', false)).toBe(
    false,
  );
  expect(canShowLocalNotification('friend_done', now, 'UTC', '2026-01-15T09:00:00Z', false)).toBe(
    true,
  );
});

it('subscribes only when enabled, delivers a qualifying update, and opens a clicked notification', async () => {
  const open = vi.fn();
  const stop = vi.fn(async () => {});
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(row.updatedAt));
  const RealDate = Date;
  // Keep real timers for waitFor while controlling the timestamp taken by the handler.
  vi.stubGlobal(
    'Date',
    class extends RealDate {
      constructor(value?: string | number) {
        super(value ?? clock());
      }
    },
  );
  const timezone = vi
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockReturnValue({ timeZone: 'UTC' } as Intl.ResolvedDateTimeFormatOptions);
  vi.mocked(onAction).mockResolvedValue({
    unregister: stop,
    plugin: 'notification',
    event: 'actionPerformed',
    channelId: 1,
  });
  vi.mocked(fetchFriendDonePushBaseline).mockResolvedValue(
    new Map([[row.id, { count: 1, updatedAt: '2026-01-15T11:00:00Z' }]]),
  );
  const client = {} as NodiiClient;
  try {
    const hook = renderHook(
      ({ enabled, watching }) => useLocalNotifications(client, 'me', enabled, watching, open),
      {
        initialProps: { enabled: false, watching: false },
      },
    );
    expect(subscribeNotifications).not.toHaveBeenCalled();
    hook.rerender({ enabled: true, watching: false });
    await act(async () => {});
    const push = vi.mocked(subscribeNotifications).mock.calls[0]?.[3];
    expect(push).toBeDefined();
    push?.('UPDATE', row);
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('plugin:notification|notify', {
        options: {
          title: 'Nodii',
          body: expect.stringContaining('민수'),
          extra: { notificationId: 'push' },
        },
      }),
    );
    hook.rerender({ enabled: true, watching: true });
    await act(async () => push?.('INSERT', { ...row, id: 'follow', kind: 'follow' }));
    expect(fetchSocialProfile).toHaveBeenCalledTimes(1);
    const tap = vi.mocked(onAction).mock.calls[0]?.[0];
    tap?.({
      actionId: 'tap',
      inputValue: null,
      notification: {
        id: 1,
        groupSummary: false,
        data: {},
        extra: { notificationId: 'push' },
        attachments: [],
      },
    });
    expect(open).toHaveBeenCalledWith('push');
    await waitFor(() => expect(windowMocks.setFocus).toHaveBeenCalled());
    hook.unmount();
    expect(stop).toHaveBeenCalled();
  } finally {
    clock.mockRestore();
    timezone.mockRestore();
    vi.unstubAllGlobals();
  }
});
