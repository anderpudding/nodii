import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { Text } from 'react-native';
import type { NodiiClient } from '@nodii/api';
import {
  checkHandle,
  checkProfileText,
  createSocialProfile,
  fetchMySocialProfile,
  fetchProfile,
  fetchSocialProfile,
  resolveInvite,
} from '@nodii/api';
import type { SocialProfile } from '@nodii/core';
import { SocialShell } from './SocialShell';
import { ToastProvider } from '../../components/Toast';

jest.mock('../../../../../packages/api/src/repositories/social-profiles', () => ({
  checkHandle: jest.fn(),
  checkProfileText: jest.fn(),
  createSocialProfile: jest.fn(),
  fetchMySocialProfile: jest.fn(),
  fetchSocialProfile: jest.fn(),
  updateSocialProfile: jest.fn(),
}));
jest.mock('../../../../../packages/api/src/profile', () => ({ fetchProfile: jest.fn() }));
jest.mock('../../../../../packages/api/src/invites', () => ({ resolveInvite: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

const mine: SocialProfile = {
  userId: 'me',
  nickname: 'Reader',
  handle: 'reader',
  searchable: true,
  bio: '',
  avatarPath: null,
  autoHiddenAt: null,
  handleChangedAt: null,
  updatedAt: '',
};
const client = {} as NodiiClient;
beforeEach(() => {
  jest.clearAllMocks();
  onlineManager.setOnline(true);
  jest.mocked(fetchMySocialProfile).mockResolvedValue(mine);
  jest.mocked(checkProfileText).mockResolvedValue('ok');
  jest.mocked(fetchProfile).mockResolvedValue({
    id: 'me',
    defaultVisibility: 'private',
    displayName: null,
    timezone: 'UTC',
    weekStart: 0,
  });
});
afterEach(() => onlineManager.setOnline(true));

function mount(enabled = true, token: string | null = null) {
  const query = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  const consume = jest.fn();
  const ui = (token: string | null) => (
    <QueryClientProvider client={query}>
      <ToastProvider>
        <SocialShell
          client={client}
          userId="me"
          enabled={enabled}
          token={token}
          consume={consume}
          email="me@example.test"
          onLogout={() => {}}
          loggingOut={false}
          onAccountDeleted={async () => {}}
        >
          <Text>Today contents</Text>
        </SocialShell>
      </ToastProvider>
    </QueryClientProvider>
  );
  const view = render(ui(token));
  return { consume, setToken: (value: string) => view.rerender(ui(value)) };
}

it('keeps the original Today when social is off', () => {
  mount(false);
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.getByText('Today contents')).toBeVisible();
});

it('switches tabs and waits for valid inputs and ID availability', async () => {
  jest.mocked(fetchMySocialProfile).mockResolvedValue(null);
  jest
    .mocked(checkHandle)
    .mockImplementation(async (_client, handle) =>
      handle === 'reader' ? 'taken' : handle === 'admin' ? 'reserved' : 'ok',
    );
  jest.mocked(createSocialProfile).mockResolvedValue(mine);
  mount();
  fireEvent.press(screen.getByRole('tab', { name: '알림' }));
  expect(screen.getByText('아직 알림이 없어요')).toBeVisible();
  fireEvent.press(screen.getByRole('tab', { name: '프로필' }));
  const id = await screen.findByLabelText('ID');
  expect(screen.getByText('ID는 3~20자로 써 주세요')).toBeVisible();
  act(() => onlineManager.setOnline(false));
  fireEvent.changeText(id, 'open');
  expect(await screen.findByText('연결되면 확인할게요')).toBeVisible();
  act(() => onlineManager.setOnline(true));
  expect(await screen.findByText('사용할 수 있어요')).toBeVisible();
  expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled();
  fireEvent.changeText(id, 'reader');
  expect(screen.getByText('확인하고 있어요')).toBeVisible();
  expect(await screen.findByText('이미 쓰고 있어요')).toBeVisible();
  fireEvent.changeText(id, 'admin');
  expect(await screen.findByText('지금은 쓸 수 없는 이름이에요')).toBeVisible();
  fireEvent.changeText(id, 'New_Reader');
  fireEvent.changeText(screen.getByLabelText('닉네임'), ' 새 이름 ');
  await waitFor(() => expect(screen.getByRole('button', { name: '시작하기' })).toBeEnabled());
  fireEvent.press(screen.getByRole('button', { name: '시작하기' }));
  await waitFor(() =>
    expect(createSocialProfile).toHaveBeenCalledWith(client, 'me', {
      handle: 'new_reader',
      nickname: '새 이름',
    }),
  );
});

it('hides the tab bar in settings and shows the locked ID editor', async () => {
  jest
    .mocked(fetchMySocialProfile)
    .mockResolvedValue({ ...mine, handleChangedAt: new Date().toISOString() });
  mount();
  fireEvent.press(screen.getByRole('tab', { name: '프로필' }));
  fireEvent.press(await screen.findByRole('button', { name: '설정' }));
  expect(await screen.findByRole('switch', { name: 'ID로 검색 허용' })).toBeVisible();
  expect(screen.queryByRole('tab')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: '새 목표의 기본 공개 범위' }));
  expect(await screen.findAllByRole('radio')).toHaveLength(3);
  fireEvent.press(screen.getByRole('button', { name: '‹ 설정' }));
  fireEvent.press(await screen.findByRole('button', { name: 'ID' }));
  expect(await screen.findByText('30일 뒤에 바꿀 수 있어요')).toBeVisible();
  expect(screen.getByLabelText('ID')).toBeDisabled();
});

it('opens an invite when the user has a profile, with self and invalid link handling', async () => {
  jest
    .mocked(resolveInvite)
    .mockResolvedValueOnce('other')
    .mockResolvedValueOnce('me')
    .mockResolvedValueOnce(null);
  jest
    .mocked(fetchSocialProfile)
    .mockResolvedValue({ ...mine, userId: 'other', nickname: 'Friend' });
  const { consume, setToken } = mount(true, 'friend');
  expect(await screen.findByText('Friend')).toBeVisible();
  expect(consume).toHaveBeenCalledWith('friend');
  setToken('my-link');
  expect(await screen.findByText('Reader')).toBeVisible();
  setToken('wrong');
  expect(await screen.findByText('링크를 열 수 없어요')).toBeTruthy();
});
