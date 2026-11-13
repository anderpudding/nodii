import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { SocialShell } from './SocialShell';
import { baseUrl, createTestClient, sessionResponse } from '../../test/auth-fixtures';
import { server } from '../../test/server';
import type { Session } from '@nodii/api';

const userId = sessionResponse.user.id;
const rest = `${baseUrl}/rest/v1`;
const existing = {
  user_id: userId,
  handle: 'reader',
  nickname: 'Reader',
  bio: '',
  avatar_path: null,
  searchable: true,
  handle_changed_at: null,
  auto_hidden_at: null,
  updated_at: 'date',
};

const disposers: (() => Promise<void>)[] = [];
afterEach(async () => {
  cleanup();
  onlineManager.setOnline(true);
  await Promise.all(disposers.splice(0).map((fn) => fn()));
  vi.restoreAllMocks();
});

function mount(enabled: boolean, token: string | null = null) {
  const client = createTestClient();
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  disposers.push(async () => {
    cache.clear();
    await client.auth.dispose();
  });
  const consume = vi.fn();
  const ui = (enabled: boolean, token: string | null) => (
    <QueryClientProvider client={cache}>
      <SocialShell
        client={client}
        session={sessionResponse as Session}
        profile={{
          id: userId,
          displayName: null,
          weekStart: 0,
          timezone: 'UTC',
          defaultVisibility: 'private',
        }}
        enabled={enabled}
        token={token}
        consume={consume}
      >
        <input aria-label="Today date state" defaultValue="2026-11-13" />
      </SocialShell>
    </QueryClientProvider>
  );
  const view = render(ui(enabled, token));
  return { consume, setToken: (next: string) => view.rerender(ui(enabled, next)) };
}

it('preserves Today and removes the tabs when social is disabled', () => {
  mount(false);
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.getByLabelText('Today date state')).toBeTruthy();
});

it('checks six ID states and enables creation only for a valid nickname and available ID', async () => {
  const post = vi.fn();
  server.use(
    http.get(`${rest}/social_profiles`, () => HttpResponse.json([])),
    http.post(`${rest}/rpc/text_is_allowed`, () => HttpResponse.json(true)),
    http.post(`${rest}/rpc/text_is_reserved`, () => HttpResponse.json(false)),
    http.post(`${rest}/rpc/handle_available`, async ({ request }) => {
      const { p_handle } = (await request.json()) as { p_handle: string };
      return HttpResponse.json(
        p_handle === 'admin' ? 'held' : p_handle === 'reader' ? 'taken' : 'ok',
      );
    }),
    http.post(`${rest}/social_profiles`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      post(body);
      return HttpResponse.json({ ...existing, ...body });
    }),
  );
  const user = userEvent.setup();
  mount(true);
  const today = screen.getByLabelText('Today date state');
  await user.click(screen.getByRole('tab', { name: '알림' }));
  expect(screen.getByText('아직 알림이 없어요')).toBeTruthy();
  await user.click(screen.getByRole('tab', { name: '오늘' }));
  expect(screen.getByLabelText('Today date state')).toBe(today);
  await user.click(screen.getByRole('tab', { name: '프로필' }));
  const id = await screen.findByRole('textbox', { name: 'ID' });
  const start = screen.getByRole('button', { name: '시작하기' });
  expect(screen.getByText('ID는 3~20자로 써 주세요')).toBeTruthy();
  act(() => onlineManager.setOnline(false));
  await user.type(id, 'good');
  expect(await screen.findByText('연결되면 확인할게요')).toBeTruthy();
  act(() => onlineManager.setOnline(true));
  expect(await screen.findByText('사용할 수 있어요')).toBeTruthy();
  expect((start as HTMLButtonElement).disabled).toBe(true);
  await user.clear(id);
  await user.type(id, 'reader');
  expect(screen.getByText('확인하고 있어요')).toBeTruthy();
  expect(await screen.findByText('이미 쓰고 있어요')).toBeTruthy();
  await user.clear(id);
  await user.type(id, 'admin');
  expect(await screen.findByText('지금은 쓸 수 없는 이름이에요')).toBeTruthy();
  await user.clear(id);
  await user.type(id, 'New_Reader');
  await user.type(screen.getByRole('textbox', { name: '닉네임' }), ' 새 이름 ');
  await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
  await user.click(start);
  expect(await screen.findByRole('heading', { name: '새 이름' })).toBeTruthy();
  expect(post).toHaveBeenCalledWith(
    expect.objectContaining({ handle: 'new_reader', nickname: '새 이름' }),
  );
});

it('opens settings, the three visibility choices, and a locked ID editor', async () => {
  server.use(
    http.get(`${rest}/social_profiles`, () =>
      HttpResponse.json([{ ...existing, handle_changed_at: new Date().toISOString() }]),
    ),
  );
  const user = userEvent.setup();
  mount(true);
  await user.click(screen.getByRole('tab', { name: '프로필' }));
  await user.click(await screen.findByRole('button', { name: '설정' }));
  expect(screen.getByRole('switch', { name: 'ID로 검색 허용' }).getAttribute('aria-checked')).toBe(
    'true',
  );
  await user.click(screen.getByRole('button', { name: /새 목표의 기본 공개 범위/ }));
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  await user.click(screen.getAllByRole('button', { name: '설정' }).at(-1)!);
  await user.click(screen.getByRole('button', { name: /30일에 한 번/ }));
  expect((screen.getByRole('textbox', { name: 'ID' }) as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText('30일 뒤에 바꿀 수 있어요')).toBeTruthy();
});

it('consumes an invite for another profile, returns home for a self link, and reports an invalid one', async () => {
  const error = vi.spyOn(toast, 'error').mockImplementation(() => '');
  server.use(
    http.get(`${rest}/social_profiles`, ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.get('user_id') === 'eq.other'
          ? [{ ...existing, user_id: 'other', nickname: 'Friend' }]
          : [existing],
      ),
    ),
    http.post(`${rest}/rpc/resolve_invite`, async ({ request }) => {
      const { p_token } = (await request.json()) as { p_token: string };
      return HttpResponse.json(p_token === 'friend' ? 'other' : p_token === 'mine' ? userId : null);
    }),
  );
  const { consume, setToken } = mount(true, 'friend');
  expect(await screen.findByRole('heading', { name: 'Friend' })).toBeTruthy();
  expect(consume).toHaveBeenCalledWith('friend');
  setToken('mine');
  expect(await screen.findByRole('heading', { name: 'Reader' })).toBeTruthy();
  setToken('wrong');
  await waitFor(() => expect(error).toHaveBeenCalledWith('링크를 열 수 없어요'));
});

const friend = { ...existing, user_id: 'other', handle: 'friend', nickname: 'Friend' };

function socialHandlers({
  hidden = false,
  followsMe = false,
}: { hidden?: boolean; followsMe?: boolean } = {}) {
  let following = false;
  let follower = followsMe;
  let blocked = false;
  const search = vi.fn();
  const write = vi.fn();
  const mail = vi.fn();
  server.use(
    http.get(`${rest}/invite_links`, () => HttpResponse.json([{ token: 'local' }])),
    http.get(`${rest}/social_profiles`, ({ request }) => {
      const filter = new URL(request.url).searchParams.get('user_id');
      if (filter === `eq.${userId}`)
        return HttpResponse.json([
          { ...existing, auto_hidden_at: hidden ? 'now' : null, bio: 'Own bio' },
        ]);
      return HttpResponse.json(
        blocked
          ? []
          : [
              {
                ...friend,
                auto_hidden_at: hidden ? 'now' : null,
                bio: 'Other bio',
                avatar_path: hidden ? 'other/image' : null,
              },
            ],
      );
    }),
    http.post(`${rest}/rpc/search_profiles`, async ({ request }) => {
      const { p_query } = (await request.json()) as { p_query: string };
      search(p_query);
      return HttpResponse.json(!blocked && p_query === 'friend' ? [existing, friend] : []);
    }),
    http.head(`${rest}/follows`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      const count = p.get('follower_id') ? Number(following) : Number(follower);
      return new HttpResponse(null, { headers: { 'Content-Range': `*/${count}` } });
    }),
    http.get(`${rest}/follows`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      if (p.get('select') === 'today_sort_key') return HttpResponse.json([]);
      const outgoing = p.get('follower_id') === `eq.${userId}`;
      return HttpResponse.json(
        (outgoing ? following : follower)
          ? [{ follower_id: outgoing ? userId : 'other', followee_id: outgoing ? 'other' : userId }]
          : [],
      );
    }),
    http.post(`${rest}/follows`, async () => {
      const result = await write();
      if (result) return result as Response;
      following = true;
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete(`${rest}/follows`, ({ request }) => {
      if (new URL(request.url).searchParams.get('follower_id') === `eq.${userId}`)
        following = false;
      else follower = false;
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${rest}/blocks`, () => {
      blocked = true;
      following = follower = false;
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete(`${rest}/blocks`, () => {
      blocked = false;
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${rest}/rpc/my_blocked_profiles`, () =>
      HttpResponse.json(blocked ? [{ ...friend, blocked_at: 'now' }] : []),
    ),
    http.post(`${baseUrl}/functions/v1/report-profile`, async ({ request }) => {
      mail(await request.json());
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${rest}/rpc/resolve_invite`, () => HttpResponse.json('other')),
  );
  return { search, write, mail };
}

it('debounces search, shows empty results, and restores a failed optimistic follow', async () => {
  const { search, write } = socialHandlers({ followsMe: true });
  let reject!: (response: Response) => void;
  write.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        reject = resolve;
      }),
  );
  const error = vi.spyOn(toast, 'error').mockImplementation(() => '');
  mount(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: '프로필' }));
  await user.click(await screen.findByRole('button', { name: '친구 찾기' }));
  const input = screen.getByRole('searchbox');
  await user.type(input, 'x');
  await act(() => new Promise((resolve) => setTimeout(resolve, 320)));
  expect(search).not.toHaveBeenCalled();
  await user.type(input, 'x');
  expect(search).not.toHaveBeenCalled();
  expect(await screen.findByText('찾는 사람이 없어요')).toBeTruthy();
  await user.clear(input);
  await user.type(input, '@Friend');
  await user.click(await screen.findByRole('button', { name: '맞팔로우' }));
  const pending = await screen.findByRole('button', { name: '팔로잉' });
  expect((pending as HTMLButtonElement).disabled).toBe(true);
  await waitFor(() => expect(write).toHaveBeenCalled());
  reject(HttpResponse.json({ code: 'P0001', message: 'rate_limited' }, { status: 400 }));
  expect(await screen.findByRole('button', { name: '맞팔로우' })).toBeTruthy();
  expect(error).toHaveBeenCalledWith('잠시 후 다시 팔로우할 수 있어요');
  await user.click(screen.getByRole('button', { name: '맞팔로우' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '팔로잉' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  await user.click(screen.getByRole('button', { name: '팔로잉' }));
  expect(screen.getByRole('alertdialog', { name: 'Friend님을 언팔로우할까요?' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '언팔로우' }));
  expect(await screen.findByRole('button', { name: '맞팔로우' })).toBeTruthy();
});

it('removes a follower from the list and opens block settings after blocking from search', async () => {
  socialHandlers({ followsMe: true });
  mount(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: '프로필' }));
  await user.click(await screen.findByRole('button', { name: '팔로워 1' }));
  await user.click(await screen.findByRole('button', { name: '팔로워에서 내보내기' }));
  await user.click(await screen.findByRole('menuitem', { name: '팔로워에서 내보내기' }));
  await user.click(await screen.findByRole('button', { name: '내보내기' }));
  expect(await screen.findByText('아직 팔로워가 없어요')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '친구 찾기' }));
  await user.type(screen.getByRole('searchbox'), 'friend');
  await user.click(await screen.findByRole('button', { name: /@friend/ }));
  (await screen.findByRole('button', { name: '프로필 메뉴' })).focus();
  await user.keyboard('{Enter}');
  await user.click(await screen.findByRole('menuitem', { name: '차단하기' }));
  await user.click(await screen.findByRole('button', { name: '차단' }));
  expect(await screen.findByText('찾는 사람이 없어요')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '설정' }));
  await user.click(await screen.findByRole('button', { name: /차단한 사람\s*1명/ }));
  await user.click(await screen.findByRole('button', { name: '차단 해제' }));
  await user.click(
    screen.getByRole('alertdialog').querySelector<HTMLButtonElement>('button:last-child')!,
  );
  expect(await screen.findByText('차단한 사람이 없어요')).toBeTruthy();
});

it('hides moderated profile fields and validates the report form and block switch', async () => {
  const { mail } = socialHandlers({ hidden: true });
  mount(true, 'friend');
  const user = userEvent.setup();
  expect(await screen.findByRole('heading', { name: 'Friend' })).toBeTruthy();
  expect(screen.queryByText('Other bio')).toBeNull();
  expect(screen.getByRole('img', { name: 'Friend' }).querySelector('img')).toBeNull();
  (await screen.findByRole('button', { name: '프로필 메뉴' })).focus();
  await user.keyboard('{Enter}');
  await user.click(screen.getByRole('menuitem', { name: '신고하기' }));
  const submit = await screen.findByRole<HTMLButtonElement>('button', { name: '신고하기' });
  expect(submit.disabled).toBe(true);
  await user.click(screen.getByRole('radio', { name: '기타' }));
  expect(submit.disabled).toBe(true);
  await user.type(screen.getByRole('textbox'), 'details');
  await user.click(screen.getByRole('switch', { name: '이 사람 차단하기' }));
  await user.click(submit);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mail).toHaveBeenCalledWith({ targetUserId: 'other', reason: 'other', detail: 'details' });
  await user.click(screen.getByRole('tab', { name: '프로필' }));
  await user.click(await screen.findByRole('button', { name: '프로필 편집' }));
  expect(
    await screen.findByText('신고가 접수되어 사진과 소개가 다른 사람에게 잠시 숨겨졌어요'),
  ).toBeTruthy();
});

it('aborts stale search and refreshes relationship counts when the window returns', async () => {
  socialHandlers();
  let count = 0;
  let didAbort = false;
  const slow = vi.fn();
  let finishSlow!: () => void;
  const slowResponse = new Promise<void>((resolve) => {
    finishSlow = resolve;
  });
  server.use(
    http.head(
      `${rest}/follows`,
      () => new HttpResponse(null, { headers: { 'Content-Range': `*/${count}` } }),
    ),
    http.post(`${rest}/rpc/search_profiles`, async ({ request }) => {
      const { p_query } = (await request.json()) as { p_query: string };
      if (p_query === 'slow') {
        request.signal.addEventListener('abort', () => {
          didAbort = true;
          finishSlow();
        });
        slow();
        await slowResponse;
      }
      return HttpResponse.json([]);
    }),
  );
  mount(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: '프로필' }));
  expect(await screen.findByRole('button', { name: '팔로워 0' })).toBeTruthy();
  count = 1;
  act(() => window.dispatchEvent(new Event('focus')));
  expect(await screen.findByRole('button', { name: '팔로워 1' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '친구 찾기' }));
  const input = screen.getByRole('searchbox');
  await user.type(input, 'slow');
  await waitFor(() => expect(slow).toHaveBeenCalled());
  await user.clear(input);
  await waitFor(() => expect(didAbort).toBe(true));
  act(() => onlineManager.setOnline(false));
  expect(screen.getByText('연결되면 찾을 수 있어요')).toBeTruthy();
});
