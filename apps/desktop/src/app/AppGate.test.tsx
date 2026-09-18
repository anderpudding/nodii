import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { AUTH_STORAGE_KEY, type NodiiClient } from '@nodii/api';
import { AppGate } from './AppGate';
import { server } from '../test/server';
import { baseUrl, createTestClient, sessionResponse } from '../test/auth-fixtures';
import { logout } from '../lib/logout';
import { authStorage } from '../lib/supabase';

const clients: NodiiClient[] = [];
const queries: QueryClient[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  queries.splice(0).forEach((query) => query.clear());
  await Promise.all(clients.splice(0).map((client) => client.auth.dispose()));
});
function setup(client = createTestClient()) {
  clients.push(client);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  queries.push(queryClient);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AppGate client={client} appVersion="0.1.0" />
    </QueryClientProvider>,
  );
  return { client, queryClient, ...view };
}

it('최소 버전 미달이면 로그인 전 업데이트 화면, ID 없으면 버튼 비활성', async () => {
  server.use(
    http.get(`${baseUrl}/rest/v1/app_config`, () => HttpResponse.json({ value: '9.9.9' })),
  );
  setup();
  expect(await screen.findByRole('heading', { name: '새 버전이 필요해요' })).toBeTruthy();
  expect(screen.queryByLabelText('이메일')).toBeNull();
  expect(
    (screen.getByRole('button', { name: 'App Store에서 업데이트' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it.each(['failure', 'invalid', 'equal'])('버전 조회 %s일 때 로그인으로 진행', async (kind) => {
  server.use(
    http.get(`${baseUrl}/rest/v1/app_config`, () =>
      kind === 'failure'
        ? HttpResponse.json({ message: 'unavailable' }, { status: 503 })
        : HttpResponse.json({ value: kind === 'invalid' ? 'broken' : '0.1.0' }),
    ),
  );
  setup();
  expect(await screen.findByLabelText('이메일')).toBeTruthy();
});
it('저장된 세션을 복원하고, 시간대 동기화 실패에도 메인 화면에 진입한다', async () => {
  const storage = new Map<string, string>();
  storage.set(
    AUTH_STORAGE_KEY,
    JSON.stringify({ ...sessionResponse, expires_at: Math.floor(Date.now() / 1000) + 3600 }),
  );
  server.use(
    http.get(`${baseUrl}/rest/v1/app_config`, () => HttpResponse.json({ value: '0.1.0' })),
    http.get(`${baseUrl}/rest/v1/profiles`, () =>
      HttpResponse.json({ message: 'unavailable' }, { status: 503 }),
    ),
  );
  setup(
    createTestClient({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      },
    }),
  );
  expect(await screen.findByRole('button', { name: '설정' })).toBeTruthy();
  expect(screen.queryByLabelText('이메일')).toBeNull();
});
it('로그인 → 메인 → 로그아웃에 따라 캐시와 인증 저장소를 비운다', async () => {
  server.use(
    http.get(`${baseUrl}/rest/v1/app_config`, () => HttpResponse.json({ value: '0.1.0' })),
    http.post(`${baseUrl}/auth/v1/otp`, () => HttpResponse.json({})),
    http.post(`${baseUrl}/auth/v1/verify`, () => HttpResponse.json(sessionResponse)),
    http.get(`${baseUrl}/rest/v1/profiles`, () =>
      HttpResponse.json({
        id: sessionResponse.user.id,
        display_name: null,
        week_start: 0,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    ),
    http.post(`${baseUrl}/auth/v1/logout`, () => new HttpResponse(null, { status: 204 })),
  );
  const { client, queryClient } = setup();
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('이메일'), 'user@example.com');
  await user.click(screen.getByRole('button', { name: '코드 받기' }));
  await user.click(await screen.findByLabelText('6자리 인증 코드'));
  await user.paste('123456');
  await user.click(await screen.findByRole('button', { name: '설정' }));
  expect(screen.getByText('user@example.com')).toBeTruthy();
  queryClient.setQueryData(['private-test'], ['private-data']);
  await user.click(screen.getByRole('menuitem', { name: '로그아웃' }));
  expect(await screen.findByLabelText('이메일')).toBeTruthy();
  expect(queryClient.getQueryData(['private-test'])).toBeUndefined();
  expect((await client.auth.getSession()).data.session).toBeNull();
});
it.each([
  [{ status: 429 }, 'rate_limited'],
  [new Error('Unexpected error'), 'unknown'],
])(
  '네트워크 외 로그아웃 오류 %j는 실패로 처리하고 로컬 정리를 하지 않는다',
  async (error, code) => {
    const clear = vi.fn();
    const client = createTestClient();
    clients.push(client);
    const queryClient = new QueryClient();
    queries.push(queryClient);
    queryClient.setQueryData(['private-test'], ['private-data']);
    vi.spyOn(client.auth, 'signOut').mockRejectedValue(error);
    await expect(logout(client, queryClient, clear)).rejects.toEqual({ code });
    expect(queryClient.getQueryData(['private-test'])).toEqual(['private-data']);
    expect(clear).not.toHaveBeenCalled();
  },
);
it.each([false, true])(
  '로그아웃은 로컬 정리 후 서버 로그아웃 여부를 반환한다 (오프라인: %s)',
  async (offline) => {
    const clear = vi.fn();
    const client = createTestClient();
    clients.push(client);
    const queryClient = new QueryClient();
    queries.push(queryClient);
    queryClient.setQueryData(['private-test'], ['private-data']);
    const signOut = vi.spyOn(client.auth, 'signOut');
    if (offline) signOut.mockRejectedValue(new TypeError('Failed to fetch'));
    else signOut.mockResolvedValue({ error: null });

    await expect(logout(client, queryClient, clear)).resolves.toEqual({ localOnly: offline });
    expect(queryClient.getQueryData(['private-test'])).toBeUndefined();
    expect(clear).toHaveBeenCalledOnce();
  },
);
it('오프라인 로그아웃은 인증 저장소와 캐시를 비우고 로그인 화면과 로컬 로그아웃 토스트를 표시한다', async () => {
  await authStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ ...sessionResponse, expires_at: Math.floor(Date.now() / 1000) + 3600 }),
  );
  await authStorage.setItem(`${AUTH_STORAGE_KEY}-code-verifier`, 'test-verifier');
  await authStorage.setItem(`${AUTH_STORAGE_KEY}-user`, JSON.stringify(sessionResponse.user));
  const successToast = vi.spyOn(toast, 'success');
  const errorToast = vi.spyOn(toast, 'error');
  server.use(
    http.get(`${baseUrl}/rest/v1/app_config`, () => HttpResponse.json({ value: '0.1.0' })),
    http.get(`${baseUrl}/rest/v1/profiles`, () =>
      HttpResponse.json({
        id: sessionResponse.user.id,
        display_name: null,
        week_start: 0,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    ),
    http.post(`${baseUrl}/auth/v1/logout`, () => HttpResponse.error()),
  );
  const { client, queryClient } = setup(createTestClient(authStorage));
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '설정' }));
  queryClient.setQueryData(['private-test'], ['private-data']);
  await user.click(screen.getByRole('menuitem', { name: '로그아웃' }));

  expect(await screen.findByLabelText('이메일')).toBeTruthy();
  await waitFor(() => expect(successToast).toHaveBeenCalledWith('이 기기에서 로그아웃했어요'));
  expect(errorToast).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(['private-test'])).toBeUndefined();
  for (const key of [
    AUTH_STORAGE_KEY,
    `${AUTH_STORAGE_KEY}-code-verifier`,
    `${AUTH_STORAGE_KEY}-user`,
  ]) {
    expect(await authStorage.getItem(key)).toBeNull();
  }
  expect((await client.auth.getSession()).data.session).toBeNull();
});
it('오프라인 로그아웃 중 인증 저장소 정리 실패는 성공으로 처리하지 않는다', async () => {
  const client = createTestClient();
  clients.push(client);
  const queryClient = new QueryClient();
  queries.push(queryClient);
  vi.spyOn(client.auth, 'signOut').mockRejectedValue(new TypeError('Failed to fetch'));
  const storageError = new Error('Storage unavailable');
  const clear = vi.fn().mockRejectedValue(storageError);

  await expect(logout(client, queryClient, clear)).rejects.toBe(storageError);
});
it('인증 구독은 화면 해제 시 정리한다', async () => {
  server.use(
    http.get(`${baseUrl}/rest/v1/app_config`, () => HttpResponse.json({ value: '0.1.0' })),
  );
  const client = createTestClient();
  const listener = vi.spyOn(client.auth, 'onAuthStateChange');
  const { unmount } = setup(client);
  await screen.findByLabelText('이메일');
  const subscription = listener.mock.results[0]?.value.data.subscription;
  const unsubscribe = vi.spyOn(subscription, 'unsubscribe');
  await act(async () => unmount());
  await waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
});
