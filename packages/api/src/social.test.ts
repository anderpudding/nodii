import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  avatarUrl,
  checkHandle,
  checkProfileText,
  clearMyAvatarFolder,
  createGoal,
  createNodiiClient,
  createSocialProfile,
  deleteMyAccount,
  fetchMyInvite,
  fetchMySocialProfile,
  fetchSocialEnabled,
  fetchSocialProfile,
  removeAvatar,
  resolveInvite,
  socialErrorCode,
  updateDefaultVisibility,
  updateSocialProfile,
  uploadAvatar,
} from './index';

const base = 'http://127.0.0.1:54321';
const rest = `${base}/rest/v1`;
const objects = `${base}/storage/v1/object`;
const row = {
  user_id: 'me',
  handle: 'reader',
  nickname: 'Reader',
  bio: 'Bio',
  avatar_path: 'me/old',
  searchable: true,
  handle_changed_at: null,
  auto_hidden_at: 'date',
  updated_at: 'date',
};
const bytes = { 160: new ArrayBuffer(2), 480: new ArrayBuffer(4) };
const forbidden = () => HttpResponse.json({ code: '42501', message: 'denied' }, { status: 403 });
const server = setupServer();
const client = createNodiiClient({
  url: base,
  publishableKey: 'fake',
  storage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
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

it('reads the exact social flag and fails closed for missing, unavailable or delayed responses', async () => {
  server.use(
    http.get(`${rest}/app_config`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('key')).toBe('eq.social_enabled');
      return HttpResponse.json([{ value: 'true' }]);
    }),
  );
  expect(await fetchSocialEnabled(client)).toBe(true);
  for (const body of [[], [{ value: 'TRUE' }], [{ value: 'false' }]]) {
    server.use(http.get(`${rest}/app_config`, () => HttpResponse.json(body)));
    expect(await fetchSocialEnabled(client)).toBe(false);
  }
  server.use(http.get(`${rest}/app_config`, forbidden));
  expect(await fetchSocialEnabled(client)).toBe(false);
  server.use(
    http.get(`${rest}/app_config`, async () => {
      await delay(3400);
      return HttpResponse.json([{ value: 'true' }]);
    }),
  );
  expect(await fetchSocialEnabled(client)).toBe(false);
}, 5000);

it('reads a specific profile and keeps auto-hidden content only for the owner', async () => {
  const ids: (string | null)[] = [];
  server.use(
    http.get(`${rest}/social_profiles`, ({ request }) => {
      ids.push(new URL(request.url).searchParams.get('user_id'));
      return HttpResponse.json([row]);
    }),
  );
  expect(await fetchMySocialProfile(client, 'me')).toMatchObject({
    bio: 'Bio',
    avatarPath: 'me/old',
  });
  expect(await fetchSocialProfile(client, 'other')).toMatchObject({ bio: '', avatarPath: null });
  expect(ids).toEqual(['eq.me', 'eq.other']);
  server.use(http.get(`${rest}/social_profiles`, () => HttpResponse.json([])));
  expect(await fetchMySocialProfile(client, 'me')).toBeNull();
  expect(await fetchSocialProfile(client, 'other')).toBeNull();
  server.use(http.get(`${rest}/social_profiles`, forbidden));
  await expect(fetchMySocialProfile(client, 'me')).rejects.toMatchObject({ code: '42501' });
  await expect(fetchSocialProfile(client, 'other')).rejects.toMatchObject({ code: '42501' });
});

it('creates a profile and updates only the fields being edited, propagating server rejection', async () => {
  server.use(
    http.post(`${rest}/social_profiles`, async ({ request }) => {
      expect(await request.json()).toEqual({ user_id: 'me', handle: 'reader', nickname: 'Reader' });
      return HttpResponse.json(row);
    }),
    http.patch(`${rest}/social_profiles`, async ({ request }) => {
      expect(new URL(request.url).searchParams.get('user_id')).toBe('eq.me');
      expect(await request.json()).toEqual({ searchable: false });
      return HttpResponse.json({ ...row, searchable: false });
    }),
  );
  const input = { handle: row.handle, nickname: row.nickname };
  expect(await createSocialProfile(client, 'me', input)).toMatchObject(input);
  expect(await updateSocialProfile(client, 'me', { searchable: false })).toMatchObject({
    searchable: false,
  });
  server.use(
    http.post(`${rest}/social_profiles`, forbidden),
    http.patch(`${rest}/social_profiles`, forbidden),
  );
  await expect(createSocialProfile(client, 'me', input)).rejects.toMatchObject({ code: '42501' });
  await expect(updateSocialProfile(client, 'me', {})).rejects.toMatchObject({ code: '42501' });
});

it('uses the existing RPCs for availability and text moderation', async () => {
  const statuses = ['ok', 'taken', 'held', 'reserved', 'banned', 'invalid'];
  server.use(
    http.post(`${rest}/rpc/handle_available`, async ({ request }) => {
      expect(await request.json()).toEqual({ p_handle: 'reader' });
      return HttpResponse.json(statuses.shift());
    }),
    http.post(`${rest}/rpc/text_is_allowed`, () => HttpResponse.json(false)),
    http.post(`${rest}/rpc/text_is_reserved`, () => HttpResponse.json(false)),
  );
  for (const status of [...statuses]) expect(await checkHandle(client, 'reader')).toBe(status);
  expect(await checkProfileText(client, 'Reader', true, new AbortController().signal)).toBe(
    'banned',
  );
  server.use(
    http.post(`${rest}/rpc/handle_available`, forbidden),
    http.post(`${rest}/rpc/text_is_allowed`, forbidden),
  );
  await expect(checkHandle(client, 'reader')).rejects.toMatchObject({ code: '42501' });
  await expect(
    checkProfileText(client, 'Reader', false, new AbortController().signal),
  ).rejects.toMatchObject({ code: '42501' });
});

it('fetches the owner token and resolves links without disclosing why one is unavailable', async () => {
  server.use(
    http.get(`${rest}/invite_links`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('user_id')).toBe('eq.me');
      return HttpResponse.json([{ token: 'token' }]);
    }),
    http.post(`${rest}/rpc/resolve_invite`, async ({ request }) =>
      HttpResponse.json(
        ((await request.json()) as { p_token: string }).p_token === 'token' ? 'other' : null,
      ),
    ),
  );
  expect(await fetchMyInvite(client, 'me')).toBe('token');
  expect(await resolveInvite(client, 'token')).toBe('other');
  expect(await resolveInvite(client, 'missing')).toBeNull();
  server.use(
    http.get(`${rest}/invite_links`, forbidden),
    http.post(`${rest}/rpc/resolve_invite`, forbidden),
  );
  await expect(fetchMyInvite(client, 'me')).rejects.toMatchObject({ code: '42501' });
  await expect(resolveInvite(client, 'token')).rejects.toMatchObject({ code: '42501' });
});

it('passes the chosen setting to new goals, and stops creation when the setting cannot be read', async () => {
  const settings = { id: 'me', timezone: 'UTC', week_start: 0, default_visibility: 'mutual' };
  const insert = vi.fn();
  server.use(
    http.patch(`${rest}/profiles`, async ({ request }) => {
      expect(await request.json()).toEqual({ default_visibility: 'mutual' });
      return HttpResponse.json(settings);
    }),
    http.get(`${rest}/profiles`, () => HttpResponse.json(settings)),
    http.post(`${rest}/goals`, async ({ request }) => {
      const body = await request.json();
      insert(body);
      return HttpResponse.json(body);
    }),
  );
  expect(await updateDefaultVisibility(client, 'me', 'mutual')).toMatchObject({
    defaultVisibility: 'mutual',
  });
  const goal = { id: 'one', name: 'Walk', color: '#000000', sortKey: 'a0', archivedAt: null };
  await createGoal(client, goal, 'me');
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'mutual' }));
  server.use(http.patch(`${rest}/profiles`, forbidden), http.get(`${rest}/profiles`, forbidden));
  await expect(updateDefaultVisibility(client, 'me', 'private')).rejects.toMatchObject({
    code: '42501',
  });
  await expect(createGoal(client, goal, 'me')).rejects.toMatchObject({ code: '42501' });
  expect(insert).toHaveBeenCalledTimes(1);
});

function avatarServer(fail?: 'second' | 'patch') {
  const calls: unknown[] = [];
  let path: string | null = row.avatar_path;
  server.use(
    http.get(`${rest}/social_profiles`, () => HttpResponse.json([{ ...row, avatar_path: path }])),
    http.post(`${objects}/avatars/me/:file`, ({ params }) => {
      calls.push(params.file);
      return fail === 'second' && params.file === 'new_480.jpg'
        ? forbidden()
        : HttpResponse.json({ Key: params.file });
    }),
    http.patch(`${rest}/social_profiles`, async ({ request }) => {
      calls.push('profile');
      if (fail === 'patch') return forbidden();
      path = ((await request.json()) as { avatar_path: string | null }).avatar_path;
      return HttpResponse.json({ ...row, avatar_path: path });
    }),
    http.delete(`${objects}/avatars`, async ({ request }) => {
      calls.push(await request.json());
      return HttpResponse.json([]);
    }),
  );
  return { calls, path: () => path };
}
it('uploads both sizes before changing the row, then removes the old pair', async () => {
  const { calls } = avatarServer();
  expect(await uploadAvatar(client, 'me', bytes, 'new')).toMatchObject({ avatarPath: 'me/new' });
  expect(calls).toEqual([
    'new_160.jpg',
    'new_480.jpg',
    'profile',
    { prefixes: ['me/old_160.jpg', 'me/old_480.jpg'] },
  ]);
  expect(avatarUrl(client, 'me/new', 480)).toBe(`${objects}/public/avatars/me/new_480.jpg`);
});
it.each(['second', 'patch'] as const)(
  'cleans the new batch after %s fails without changing the old photo',
  async (fail) => {
    const { calls, path } = avatarServer(fail);
    await expect(uploadAvatar(client, 'me', bytes, 'new')).rejects.toBeTruthy();
    expect(path()).toBe('me/old');
    expect(calls.at(-1)).toEqual({ prefixes: ['me/new_160.jpg', 'me/new_480.jpg'] });
  },
);
it('restores the default avatar only after the profile update succeeds', async () => {
  const { calls } = avatarServer();
  expect(await removeAvatar(client, 'me')).toMatchObject({ avatarPath: null });
  expect(calls).toEqual(['profile', { prefixes: ['me/old_160.jpg', 'me/old_480.jpg'] }]);
  const failed = avatarServer('patch');
  await expect(removeAvatar(client, 'me')).rejects.toBeTruthy();
  expect(failed.calls).toEqual(['profile']);
});
it('cleans before account deletion, but a failed cleanup does not block deletion', async () => {
  const calls: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  server.use(
    http.post(`${objects}/list/avatars`, async ({ request }) => {
      expect(await request.json()).toMatchObject({ prefix: 'me' });
      calls.push('list');
      return HttpResponse.json([{ name: 'old_160.jpg', id: 'one' }]);
    }),
    http.delete(`${objects}/avatars`, async ({ request }) => {
      expect(await request.json()).toEqual({ prefixes: ['me/old_160.jpg'] });
      calls.push('files');
      return HttpResponse.json([]);
    }),
    http.post(`${rest}/rpc/delete_my_account`, () => {
      calls.push('account');
      return HttpResponse.json(null);
    }),
  );
  await deleteMyAccount(client, 'me');
  expect(calls).toEqual(['list', 'files', 'account']);
  server.use(http.post(`${objects}/list/avatars`, forbidden));
  await expect(clearMyAvatarFolder(client, 'me')).rejects.toBeTruthy();
  await deleteMyAccount(client, 'me');
  expect(calls.at(-1)).toBe('account');
  expect(warn).toHaveBeenCalledOnce();
});
it('returns narrow error codes instead of server messages', () => {
  expect(socialErrorCode({ code: '23505', message: 'private details' })).toBe('taken');
  for (const code of ['reserved', 'banned', 'handle_cooldown', 'handle_held'])
    expect(socialErrorCode({ code: 'P0001', message: code })).toBe(code);
  expect(socialErrorCode(new TypeError('Failed to fetch'))).toBe('network');
  expect(socialErrorCode(new Error('private details'))).toBe('unknown');
});
