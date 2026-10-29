import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { setLocale } from '@nodii/i18n';
import { getVersion } from '@tauri-apps/api/app';
import { SettingsSheet } from './SettingsSheet';
import { useLocale } from '../../lib/language';
import { createTestClient, sessionResponse, testUser } from '../../test/auth-fixtures';

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));
const clients: ReturnType<typeof createTestClient>[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.auth.dispose();
  vi.clearAllMocks();
});

it.each([
  ['checking', '확인 중…', 'Checking…'],
  ['failed', '확인하지 못했어요', "Couldn't check"],
] as const)('버전 조회 %s 상태도 언어 전환 때 즉시 번역한다', async (state, korean, english) => {
  vi.mocked(getVersion).mockImplementation(() =>
    state === 'checking' ? new Promise<string>(() => {}) : Promise.reject(new Error('IPC')),
  );
  const client = createTestClient();
  clients.push(client);
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Content() {
    useLocale();
    return (
      <SettingsSheet
        client={client}
        session={{ ...sessionResponse, token_type: 'bearer' }}
        profile={{ id: testUser.id, displayName: null, timezone: 'UTC', weekStart: 0 }}
        onClose={() => {}}
        onOpenArchivedGoals={() => {}}
      />
    );
  }
  render(
    <QueryClientProvider client={cache}>
      <Content />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(korean)).toBeTruthy();
  act(() => setLocale('en'));
  expect(screen.getByText(english)).toBeTruthy();
  expect(screen.queryByText(korean)).toBeNull();
  expect(getVersion).toHaveBeenCalledOnce();
});
