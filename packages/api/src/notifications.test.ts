import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  clearNotificationMute,
  createNodiiClient,
  fetchMyReactions,
  fetchNotifications,
  react,
  setNotificationMute,
  socialErrorCode,
  subscribeNotifications,
  updateNotificationPrefs,
} from './index';

const base = 'http://127.0.0.1:54321';
const rest = base + '/rest/v1';
const server = setupServer();
const client = createNodiiClient({
  url: base,
  publishableKey: 'fake',
  storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
});
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(async () => {
  server.close();
  await client.auth.dispose();
});

it('reads up to 100 rows, batches actor and item metadata, and omits unavailable titles', async () => {
  const reads: string[] = [];
  const route = (
    table: string,
    response: Parameters<typeof HttpResponse.json>[0],
    check?: (q: URLSearchParams) => void,
  ) =>
    http.get(rest + '/' + table, ({ request }) => {
      reads.push(table);
      check?.(new URL(request.url).searchParams);
      return HttpResponse.json(response);
    });
  const notification = {
    actor_id: 'a',
    count: 1,
    date: '2026-11-13',
    updated_at: '2026-11-13T00:00:00Z',
  };
  server.use(
    route(
      'notifications',
      [
        { ...notification, id: '1', kind: 'reaction', todo_id: 'todo', routine_id: null },
        { ...notification, id: '2', kind: 'reaction', todo_id: 'gone', routine_id: null },
        { ...notification, id: '3', kind: 'friend_done', todo_id: null, routine_id: null },
        { ...notification, id: '4', kind: 'reaction', todo_id: null, routine_id: 'r' },
      ],
      (q) => {
        expect(q.get('recipient_id')).toBe('eq.me');
        expect(q.get('order')).toBe('updated_at.desc,id.desc');
        expect(q.get('limit')).toBe('100');
      },
    ),
    route(
      'social_profiles',
      [
        {
          user_id: 'a',
          nickname: 'A',
          auto_hidden_at: 'date',
          avatar_path: 'private',
          bio: 'Hidden',
        },
      ],
      (q) => expect(q.get('user_id')).toBe('in.(a)'),
    ),
    route('todos', [{ id: 'todo', title: 'Read', date: '2026-11-14', goal_id: 'g' }], (q) => {
      expect(q.get('id')).toBe('in.(todo,gone)');
      expect(q.get('deleted_at')).toBe('is.null');
    }),
    route('routines', [{ id: 'r', title: 'Stretch', goal_id: 'g' }]),
    route('goals', [{ id: 'g', color: '#115544' }]),
  );
  expect(await fetchNotifications(client, 'me')).toMatchObject([
    {
      actor: { nickname: 'A', avatarPath: null },
      title: 'Read',
      date: '2026-11-14',
      color: '#115544',
    },
    { title: null, color: null },
    { kind: 'friend_done', title: null },
    { title: 'Stretch', date: '2026-11-13' },
  ]);
  expect(reads.sort()).toEqual(['goals', 'notifications', 'routines', 'social_profiles', 'todos']);
});

it('omits existing notifications when their sender is no longer readable under profile RLS', async () => {
  const available = { user_id: 'available', nickname: 'Available' };
  const suspended = { user_id: 'suspended', nickname: 'Suspended later' };
  let readableProfiles = [available, suspended];
  const notification = {
    count: 1,
    date: null,
    todo_id: null,
    routine_id: null,
    kind: 'follow',
    updated_at: '2026-11-13T00:00:00Z',
  };
  server.use(
    http.get(rest + '/notifications', () =>
      HttpResponse.json([
        { ...notification, id: '1', actor_id: suspended.user_id },
        { ...notification, id: '2', actor_id: 'missing' },
        { ...notification, id: '3', actor_id: available.user_id },
      ]),
    ),
    http.get(rest + '/social_profiles', () => HttpResponse.json(readableProfiles)),
  );

  expect((await fetchNotifications(client, 'me')).map(({ id }) => id)).toEqual(['1', '3']);
  // 정지된 사람은 기존 알림 행이 남아 있어도 프로필 SELECT 결과에서는 빠진다.
  readableProfiles = [available];
  expect((await fetchNotifications(client, 'me')).map(({ id }) => id)).toEqual(['3']);
  readableProfiles = [];
  expect(await fetchNotifications(client, 'me')).toEqual([]);
});

it('filters received writes, invalidates deletes by ID, and ignores callbacks after cleanup', () => {
  const listeners: ((row: { new: { recipient_id: string }; old: { id: string } }) => void)[] = [];
  const channel = client.channel('mock');
  vi.spyOn(client, 'channel').mockReturnValue(channel);
  vi.spyOn(client, 'removeChannel').mockResolvedValue('ok');
  const on = vi.spyOn(channel, 'on').mockImplementation((_type, _filter, callback) => {
    listeners.push(callback);
    return channel;
  });
  vi.spyOn(channel, 'subscribe').mockReturnValue(channel);
  const changed = vi.fn();
  const stop = subscribeNotifications(client, 'me', changed);
  expect(on.mock.calls.map(([, filter]) => filter)).toEqual([
    { table: 'notifications', schema: 'public', event: 'INSERT', filter: 'recipient_id=eq.me' },
    { table: 'notifications', schema: 'public', event: 'UPDATE', filter: 'recipient_id=eq.me' },
    { table: 'notifications', schema: 'public', event: 'DELETE' },
  ]);
  listeners[0]?.({ new: { recipient_id: 'other' }, old: { id: '' } });
  listeners[1]?.({ new: { recipient_id: 'me' }, old: { id: '' } });
  listeners[2]?.({ new: { recipient_id: '' }, old: { id: 'deleted' } });
  stop();
  listeners[0]?.({ new: { recipient_id: 'me' }, old: { id: '' } });
  expect(changed.mock.calls).toEqual([[], ['deleted']]);
});

it.each(['not_done', 'not_visible', 'own_item'])('keeps the RPC error %s stable', async (code) => {
  server.use(
    http.post(rest + '/rpc/react', async ({ request }) => {
      expect(await request.json()).toEqual({
        p_todo_id: null,
        p_routine_id: 'r',
        p_date: '2026-11-13',
      });
      return HttpResponse.json({ code: 'P0001', message: code }, { status: 400 });
    }),
  );
  const error: unknown = await react(client, { routineId: 'r', date: '2026-11-13' }).catch(
    (e: unknown) => e,
  );
  expect(socialErrorCode(error)).toBe(code);
});

it('matches exact routine dates and fetches only reactions from me', async () => {
  server.use(
    http.get(rest + '/reactions', ({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(params.get('reactor_id')).toBe('eq.me');
      return HttpResponse.json(
        params.has('todo_id')
          ? [{ id: 'a', todo_id: 'todo' }]
          : [
              { id: 'b', routine_id: 'r', date: '2026-11-13' },
              { id: 'c', routine_id: 'r', date: '2026-11-14' },
            ],
      );
    }),
  );
  expect(
    await fetchMyReactions(
      client,
      'me',
      {
        todoIds: ['todo'],
        routineDates: [
          { routineId: 'r', date: '2026-11-13' },
          { routineId: 's', date: '2026-11-14' },
        ],
      },
      new AbortController().signal,
    ),
  ).toEqual({ 'todo:todo': 'a', 'routine:r:2026-11-13': 'b' });
});

it('saves only the changed preference and scopes the override upsert and removal', async () => {
  server.use(
    http.post(rest + '/notification_prefs', async ({ request }) => {
      expect(request.headers.get('prefer')).toContain('missing=default');
      expect(await request.json()).toEqual({
        user_id: 'me',
        reaction: false,
        updated_at: expect.any(String),
      });
      return HttpResponse.json({ reaction: false, friend_done: true, new_follower: true });
    }),
    http.post(rest + '/notification_mutes', async ({ request }) => {
      expect(await request.json()).toEqual({ user_id: 'me', actor_id: 'b', friend_done: false });
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete(rest + '/notification_mutes', ({ request }) => {
      expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual({
        user_id: 'eq.me',
        actor_id: 'eq.b',
      });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  expect(await updateNotificationPrefs(client, 'me', { reaction: false })).toEqual({
    reaction: false,
    friendDone: true,
    newFollower: true,
  });
  await setNotificationMute(client, 'me', 'b', false);
  await clearNotificationMute(client, 'me', 'b');
});
