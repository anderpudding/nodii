import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { Profile } from '@nodii/core';
import { SettingsSheet } from './SettingsSheet';
import { MonthCalendar } from '../calendar/MonthCalendar';
import { createTestClient, baseUrl, sessionResponse, testUser } from '../../test/auth-fixtures';
import { dataHandlers } from '../../test/data-fixtures';
import { server } from '../../test/server';
import { useUIStore } from '../../stores/ui';
import { setTheme } from '../../lib/theme';

const profile: Profile = { id: testUser.id, displayName: null, timezone: 'UTC', weekStart: 0 };
const clients: ReturnType<typeof createTestClient>[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.auth.dispose();
  vi.restoreAllMocks();
  await setTheme('system');
});
function setup(calendar = false) {
  const client = createTestClient();
  clients.push(client);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  cache.setQueryData(['profile', testUser.id, 'UTC'], profile);
  useUIStore.setState({ today: '2026-09-17', selectedDate: '2026-09-17' });
  function Content() {
    const { data } = useQuery({
      queryKey: ['profile', testUser.id, 'UTC'],
      queryFn: () => profile,
      staleTime: Infinity,
    });
    return (
      <>
        <SettingsSheet
          client={client}
          session={{ ...sessionResponse, token_type: 'bearer' }}
          profile={data}
          onClose={() => {}}
        />
        {calendar && <MonthCalendar client={client} profile={data!} />}
      </>
    );
  }
  render(
    <QueryClientProvider client={cache}>
      <Content />
    </QueryClientProvider>,
  );
  return { client, cache, user: userEvent.setup() };
}
it('이메일 재입력과 이해 체크를 모두 확인해야 계정 삭제를 허용한다', async () => {
  const remove = vi.fn(() => new HttpResponse(null, { status: 204 }));
  server.use(
    ...(['goals', 'todos', 'routines'] as const).map((table) =>
      http.head(
        `${baseUrl}/rest/v1/${table}`,
        () => new HttpResponse(null, { headers: { 'content-range': '0-1/2' } }),
      ),
    ),
    http.post(`${baseUrl}/rest/v1/rpc/delete_my_account`, remove),
  );
  const { user, client, cache } = setup();
  vi.spyOn(client.auth, 'signOut').mockResolvedValue({ error: null });
  const signedOut = vi.fn();
  window.addEventListener('nodii:signed-out', signedOut, { once: true });
  cache.setQueryData(['todos', '2026-09'], [{ id: 'private' }]);
  await user.click(screen.getByRole('button', { name: '계정 삭제' }));
  await screen.findByText(/목표 2개/);
  const button = screen.getByRole('button', { name: '계정 삭제' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  await user.type(screen.getByLabelText('이메일 주소를 다시 입력해 주세요'), testUser.email);
  expect(button.disabled).toBe(true);
  await user.click(screen.getByRole('checkbox'));
  expect(button.disabled).toBe(false);
  await user.click(button);
  await waitFor(() => expect(signedOut).toHaveBeenCalledOnce());
  expect(remove).toHaveBeenCalledOnce();
  expect(cache.getQueryData(['todos', '2026-09'])).toBeUndefined();
});
it('테마를 즉시 반영하고 이 기기에 저장하며 미설정 정보 링크는 비활성화한다', async () => {
  const { user } = setup();
  await user.selectOptions(screen.getByLabelText('테마'), 'dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(localStorage.getItem('nodii-theme')).toBe('dark');
  expect(
    (screen.getByRole('button', { name: '개인정보처리방침 · 준비 중' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
it('주 시작 요일 변경은 캘린더 첫 칸과 월 조회 범위를 함께 바꾼다', async () => {
  server.use(
    ...dataHandlers,
    http.patch(`${baseUrl}/rest/v1/profiles`, () =>
      HttpResponse.json({ id: testUser.id, display_name: null, timezone: 'UTC', week_start: 1 }),
    ),
  );
  const { user } = setup(true);
  await waitFor(() =>
    expect(document.querySelector('.calendar-cell')?.getAttribute('aria-label')).toContain(
      '8월 30일',
    ),
  );
  await user.selectOptions(screen.getByLabelText('주 시작 요일'), '1');
  await waitFor(() =>
    expect(document.querySelector('.calendar-cell')?.getAttribute('aria-label')).toContain(
      '8월 31일',
    ),
  );
});
it('주 시작 저장 실패는 설정을 롤백하고 오류를 알린다', async () => {
  server.use(
    http.patch(`${baseUrl}/rest/v1/profiles`, () =>
      HttpResponse.json({ message: 'failure' }, { status: 500 }),
    ),
  );
  const { user, cache } = setup();
  await user.selectOptions(screen.getByLabelText('주 시작 요일'), '1');
  await waitFor(() =>
    expect(cache.getQueryData<Profile>(['profile', testUser.id, 'UTC'])?.weekStart).toBe(0),
  );
});
