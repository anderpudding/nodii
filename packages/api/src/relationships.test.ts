import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  createNodiiClient,
  fetchFollowCounts,
  fetchFollowing,
  friendDayOptions,
  updateTodayPerson,
  fetchRelations,
  follow,
  relationshipErrorKey,
  reportProfile,
  refreshRelationships,
  searchProfiles,
  socialErrorCode,
} from './index';

const host = 'http://127.0.0.1:54321';
const rest = `${host}/rest/v1`;
const database = setupServer();
const client = createNodiiClient({
  url: host,
  publishableKey: 'fake',
  storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
});
const signal = () => new AbortController().signal;
beforeAll(() => database.listen({ onUnhandledRequest: 'error' }));
afterEach(() => database.resetHandlers());
afterAll(async () => {
  database.close();
  await client.auth.dispose();
});

it('reads both relationship directions in two requests with explicit viewer and target filters', async () => {
  const requests: URLSearchParams[] = [];
  database.use(
    http.get(`${rest}/follows`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      return HttpResponse.json(
        params.get('select') === 'followee_id'
          ? [{ followee_id: 'alpha' }]
          : [{ follower_id: 'beta' }],
      );
    }),
  );
  expect(await fetchRelations(client, 'me', ['alpha', 'beta', 'alpha'], signal())).toEqual(
    new Map([
      ['alpha', { iFollow: true, followsMe: false }],
      ['beta', { iFollow: false, followsMe: true }],
    ]),
  );
  expect(requests).toHaveLength(2);
  expect(requests.map((p) => [p.get('follower_id'), p.get('followee_id')])).toEqual(
    expect.arrayContaining([
      ['eq.me', 'in.(alpha,beta)'],
      ['in.(alpha,beta)', 'eq.me'],
    ]),
  );
  expect(await fetchRelations(client, 'me', [])).toEqual(new Map());
  expect(requests).toHaveLength(2);
});

it('appends after the current highest key and accepts a duplicate follow', async () => {
  const insert = vi.fn();
  const latest = vi.fn(() => [{ today_sort_key: 'a1' }]);
  database.use(
    http.get(`${rest}/follows`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      expect(p.get('follower_id')).toBe('eq.me');
      expect(p.get('order')).toBe('today_sort_key.desc');
      expect(p.get('limit')).toBe('1');
      return HttpResponse.json(latest());
    }),
    http.post(`${rest}/follows`, async ({ request }) => {
      insert(await request.json());
      return HttpResponse.json({ code: '23505' }, { status: 409 });
    }),
  );
  await follow(client, 'me', 'alpha');
  expect(insert).toHaveBeenLastCalledWith({
    follower_id: 'me',
    followee_id: 'alpha',
    today_sort_key: 'a2',
  });
  latest.mockReturnValue([]);
  await follow(client, 'me', 'beta');
  expect(insert).toHaveBeenLastCalledWith({
    follower_id: 'me',
    followee_id: 'beta',
    today_sort_key: 'a0',
  });
});

it('keeps the order and omits invisible profiles while reading independent exact HEAD counts', async () => {
  database.use(
    http.get(`${rest}/follows`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      expect(p.get('limit')).toBe('500');
      expect(p.get('order')).toBe('created_at.desc,followee_id.asc');
      return HttpResponse.json(
        [{ followee_id: 'b' }, { followee_id: 'hidden' }, { followee_id: 'a' }],
        { headers: { 'Content-Range': '0-2/501' } },
      );
    }),
    http.get(`${rest}/social_profiles`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('user_id')).toBe('in.(b,hidden,a)');
      return HttpResponse.json([
        { user_id: 'a', auto_hidden_at: 'now', avatar_path: 'photo', bio: 'text' },
        { user_id: 'b' },
      ]);
    }),
    http.head(`${rest}/follows`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      expect(request.headers.get('prefer')).toContain('count=exact');
      const count = p.get('follower_id') === 'eq.me' ? 501 : 1;
      return new HttpResponse(null, { headers: { 'Content-Range': `*/${count}` } });
    }),
  );
  const list = await fetchFollowing(client, 'me', signal());
  expect(list.truncated).toBe(true);
  expect(list.people.map((p) => p.userId)).toEqual(['b', 'a']);
  expect(list.people[1]).toMatchObject({ avatarPath: null, bio: '' });
  expect(await fetchFollowCounts(client, 'me', signal())).toEqual({ following: 501, followers: 1 });
});

it('normalizes search and maps private server errors to safe messages', async () => {
  const search = vi.fn();
  database.use(
    http.post(`${rest}/rpc/search_profiles`, async ({ request }) => {
      search(await request.json());
      return HttpResponse.json([]);
    }),
  );
  await searchProfiles(client, '@a', signal());
  expect(search).not.toHaveBeenCalled();
  await searchProfiles(client, ' @Abb ', signal());
  expect(search).toHaveBeenCalledWith({ p_query: 'abb' });
  expect(relationshipErrorKey({ code: 'P0001', message: 'rate_limited' }, true)).toBe(
    'social.follow.rateLimited',
  );
  for (const message of ['not_available', 'blocked', 'not_found']) {
    expect(relationshipErrorKey({ code: 'P0001', message }, true)).toBe(
      'social.follow.unavailable',
    );
  }
  expect(socialErrorCode({ code: '23505' }, 'follow')).toBe('already_following');
});

it('invalidates all current account relationship surfaces and profile headers', async () => {
  const cache = new QueryClient();
  const keys = [
    ['relationships', 'me', 'relations', ['target']],
    ['relationships', 'me', 'counts'],
    ['relationships', 'me', 'following'],
    ['relationships', 'me', 'followers'],
    ['relationships', 'me', 'blocked'],
    ['relationships', 'me', 'search', 'query'],
    ['socialProfile', 'target'],
  ];
  for (const key of [...keys, ['relationships', 'someone', 'counts'], ['goals']])
    cache.setQueryData(key, []);
  await refreshRelationships(cache, 'me');
  expect(keys.every((key) => cache.getQueryState(key)?.isInvalidated)).toBe(true);
  expect(cache.getQueryState(['relationships', 'someone', 'counts'])?.isInvalidated).toBe(false);
  expect(cache.getQueryState(['goals'])?.isInvalidated).toBe(false);
  cache.clear();
});

it('blocks only after the report is saved and returns a partial success if blocking fails', async () => {
  const events: string[] = [];
  database.use(
    http.post(`${host}/functions/v1/report-profile`, async ({ request }) => {
      expect(await request.json()).toEqual({ targetUserId: 'target', reason: 'spam' });
      events.push('report');
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${rest}/blocks`, () => {
      events.push('block');
      return HttpResponse.json({ code: '42501' }, { status: 403 });
    }),
  );
  expect(
    await reportProfile(client, 'me', { targetUserId: 'target', reason: 'spam', alsoBlock: true }),
  ).toEqual({ blocked: false, blockFailed: true });
  expect(events).toEqual(['report', 'block']);
});

it('reads all four friend datasets under a separate key with the friend owner filter', async () => {
  const requests: string[] = [];
  database.use(
    ...['goals', 'todos', 'routines', 'routine_logs'].map((table) =>
      http.get(`${rest}/${table}`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('user_id')).toBe('eq.friend');
        requests.push(table);
        return HttpResponse.json([]);
      }),
    ),
  );
  const query = friendDayOptions(client, 'friend', { from: '2026-11-01', to: '2026-12-12' });
  const cache = new QueryClient();
  cache.setQueryData(['goals'], ['own']);
  expect(await cache.fetchQuery(query)).toEqual({ goals: [], todos: [], routines: [], logs: [] });
  expect(query.queryKey).toEqual(['friend', 'friend', '2026-11-01', '2026-12-12']);
  expect(cache.getQueryData(['goals'])).toEqual(['own']);
  expect(requests.sort()).toEqual(['goals', 'routine_logs', 'routines', 'todos']);
  cache.clear();
});

it('updates only today columns on the outgoing edge', async () => {
  database.use(
    http.patch(`${rest}/follows`, async ({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(params.get('follower_id')).toBe('eq.me');
      expect(params.get('followee_id')).toBe('eq.friend');
      expect(await request.json()).toEqual({ show_on_today: true, today_sort_key: 'a1' });
      return HttpResponse.json({
        followee_id: 'friend',
        show_on_today: true,
        today_sort_key: 'a1',
        created_at: 'now',
      });
    }),
  );
  expect(
    await updateTodayPerson(client, 'me', 'friend', { showOnToday: true, todaySortKey: 'a1' }),
  ).toEqual({ followeeId: 'friend', showOnToday: true, todaySortKey: 'a1', createdAt: 'now' });
});
