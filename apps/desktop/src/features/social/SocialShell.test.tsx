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
