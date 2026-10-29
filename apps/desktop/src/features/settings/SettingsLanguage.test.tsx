import { StrictMode } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { App } from '../../App';
import { SettingsSheet } from './SettingsSheet';
import { DayHeader } from '../day-list/DayHeader';
import { CalendarGrid } from '../calendar/CalendarGrid';
import { useUIStore } from '../../stores/ui';
import { createTestClient, sessionResponse, testUser } from '../../test/auth-fixtures';
import { dataHandlers } from '../../test/data-fixtures';
import { server } from '../../test/server';
import { setLanguage } from '../../lib/language';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
// 실제 App의 로케일 구독과 Providers를 통과시키고 인증 단계만 대체한다.
vi.mock('../../app/AppGate', () => ({ AppGate: () => <Content /> }));
const clients: ReturnType<typeof createTestClient>[] = [];
const profile = { id: testUser.id, displayName: null, timezone: 'UTC', weekStart: 0 as const };
let client: ReturnType<typeof createTestClient>;
const close = vi.fn();
function Content() {
  return (
    <>
      <DayHeader />
      <CalendarGrid
        month="2026-10"
        today="2026-10-29"
        selectedDate="2026-10-28"
        weekStart={0}
        onMonthChange={() => {}}
        onSelect={() => {}}
      />
      <SettingsSheet
        client={client}
        session={{ ...sessionResponse, token_type: 'bearer' }}
        profile={profile}
        onClose={close}
        onOpenArchivedGoals={() => {}}
      />
    </>
  );
}
function setup() {
  server.use(...dataHandlers);
  client = createTestClient();
  clients.push(client);
  useUIStore.setState({ selectedDate: '2026-10-28', today: '2026-10-29' });
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return userEvent.setup();
}
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  close.mockClear();
  await setLanguage('ko');
  for (const value of clients.splice(0)) await value.auth.dispose();
});

it('App에서 재구독해 날짜·요일·언어 줄을 바꾸고 열린 시트와 초점을 유지한다', async () => {
  const user = setup();
  const sheet = screen.getByRole('dialog');
  const english = within(sheet).getByRole('radio', { name: 'English' });
  expect(screen.getByRole('heading', { name: '10월 28일 (수)' })).toBeTruthy();
  await user.click(english);
  expect(document.documentElement.lang).toBe('en');
  expect(screen.getByRole('heading', { name: 'Wed, October 28' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Wed' })).toBeTruthy();
  expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeTruthy();
  expect(
    within(screen.getByRole('radiogroup', { name: 'Language' })).getByRole('radio', {
      name: 'System',
    }),
  ).toBeTruthy();
  expect(within(sheet).getByRole('heading', { name: 'Settings' })).toBeTruthy();
  expect(sheet.textContent?.replace('한국어', '')).not.toMatch(/[가-힣]/);
  expect(screen.getByRole('dialog')).toBe(sheet);
  expect(document.activeElement).toBe(english);
  await waitFor(() => expect(english.hasAttribute('disabled')).toBe(false));
  await user.click(screen.getByRole('radio', { name: '한국어' }));
  expect(document.documentElement.lang).toBe('ko');
  expect(screen.getByRole('heading', { name: '10월 28일 (수)' })).toBeTruthy();
  expect(screen.getByRole('radiogroup', { name: '언어' })).toBeTruthy();
  expect(screen.getByRole('dialog')).toBe(sheet);
  expect(close).not.toHaveBeenCalled();
  expect(localStorage.getItem('nodii-language')).toBe('ko');
});

it('언어 저장에 실패하면 한국어로 돌아오고 토스트로 알린다', async () => {
  const user = setup();
  const error = vi.spyOn(toast, 'error');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    throw new Error('disk full');
  });
  await user.click(screen.getByRole('radio', { name: 'English' }));
  await waitFor(() => expect(error).toHaveBeenCalledWith('언어를 저장하지 못했어요'));
  expect(document.documentElement.lang).toBe('ko');
  expect(screen.getByRole('heading', { name: '10월 28일 (수)' })).toBeTruthy();
});
