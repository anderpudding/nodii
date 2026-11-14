import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { ActionSheetIOS, Alert, Text } from 'react-native';
import type { NodiiClient } from '@nodii/api';
import {
  checkHandle,
  checkProfileText,
  createSocialProfile,
  block,
  fetchBlockedProfiles,
  fetchFollowCounts,
  fetchFollowers,
  fetchFollowing,
  fetchRelations,
  follow,
  listGoals,
  listRoutines,
  removeFollower,
  reportProfile,
  searchProfiles,
  unblock,
  unfollow,
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
jest.mock('../../../../../packages/api/src/repositories/relationships', () => ({
  ...jest.requireActual('../../../../../packages/api/src/repositories/relationships'),
  block: jest.fn(),
  fetchBlockedProfiles: jest.fn(),
  fetchFollowCounts: jest.fn(),
  fetchFollowers: jest.fn(),
  fetchFollowing: jest.fn(),
  fetchRelations: jest.fn(),
  follow: jest.fn(),
  removeFollower: jest.fn(),
  reportProfile: jest.fn(),
  searchProfiles: jest.fn(),
  unblock: jest.fn(),
  unfollow: jest.fn(),
}));
jest.mock('../../../../../packages/api/src/profile', () => ({ fetchProfile: jest.fn() }));
jest.mock('../../../../../packages/api/src/invites', () => ({ resolveInvite: jest.fn() }));
jest.mock('../../../../../packages/api/src/repositories/goals', () => ({ listGoals: jest.fn() }));
jest.mock('../../../../../packages/api/src/repositories/routines', () => ({
  listRoutines: jest.fn(),
}));
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
  jest.mocked(fetchFollowCounts).mockResolvedValue({ following: 0, followers: 0 });
  jest.mocked(fetchBlockedProfiles).mockResolvedValue([]);
  jest.mocked(fetchRelations).mockResolvedValue(new Map());
  jest.mocked(fetchFollowing).mockResolvedValue({ people: [], truncated: false });
  jest.mocked(fetchFollowers).mockResolvedValue({ people: [], truncated: false });
  jest.mocked(listGoals).mockResolvedValue([]);
  jest.mocked(listRoutines).mockResolvedValue([]);
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
afterEach(() => {
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

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

const friend = { ...mine, userId: 'other', nickname: 'Friend', handle: 'friend' };

function relationshipScenario(incoming = false) {
  let iFollow = false;
  let followsMe = incoming;
  let blocked = false;
  jest.mocked(fetchSocialProfile).mockImplementation(async () => (blocked ? null : friend));
  jest.mocked(resolveInvite).mockResolvedValue(friend.userId);
  jest
    .mocked(fetchFollowCounts)
    .mockImplementation(async () => ({ following: Number(iFollow), followers: Number(followsMe) }));
  jest
    .mocked(fetchRelations)
    .mockImplementation(async () => new Map([[friend.userId, { iFollow, followsMe }]]));
  jest
    .mocked(searchProfiles)
    .mockImplementation(async (_client, raw) =>
      !blocked && raw.toLowerCase().includes('friend') ? [mine, friend] : [],
    );
  jest
    .mocked(fetchFollowers)
    .mockImplementation(async () => ({ people: followsMe ? [friend] : [], truncated: false }));
  jest.mocked(follow).mockImplementation(async () => {
    iFollow = true;
  });
  jest.mocked(unfollow).mockImplementation(async () => {
    iFollow = false;
  });
  jest.mocked(removeFollower).mockImplementation(async () => {
    followsMe = false;
  });
  jest.mocked(block).mockImplementation(async () => {
    blocked = true;
    iFollow = followsMe = false;
  });
  jest.mocked(unblock).mockImplementation(async () => {
    blocked = false;
  });
  jest
    .mocked(fetchBlockedProfiles)
    .mockImplementation(async () => (blocked ? [{ ...friend, blockedAt: 'now' }] : []));
  jest.mocked(reportProfile).mockResolvedValue({ blocked: true, blockFailed: false });
}

const lastAlert = (spy: jest.SpiedFunction<typeof Alert.alert>) => spy.mock.calls.at(-1);
const openSearch = async () => {
  fireEvent.press(screen.getByRole('tab', { name: '프로필' }));
  fireEvent.press(await screen.findByRole('button', { name: '친구 찾기' }));
  return screen.getByLabelText('이름이나 ID로 찾기');
};

it('debounces search and rolls back a failed follow before confirming an unfollow', async () => {
  relationshipScenario();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let reject!: (error: object) => void;
  jest.mocked(follow).mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  mount();
  const input = await openSearch();
  fireEvent.changeText(input, 'x');
  await act(() => new Promise((resolve) => setTimeout(resolve, 320)));
  expect(searchProfiles).not.toHaveBeenCalled();
  fireEvent.changeText(input, 'xx');
  expect(searchProfiles).not.toHaveBeenCalled();
  expect(await screen.findByText('찾는 사람이 없어요')).toBeVisible();
  fireEvent.changeText(input, 'friend');
  fireEvent.press(await screen.findByRole('button', { name: '팔로우' }));
  expect(await screen.findByRole('button', { name: '팔로잉' })).toBeDisabled();
  await waitFor(() => expect(follow).toHaveBeenCalled());
  act(() => reject({ code: 'P0001', message: 'rate_limited' }));
  expect(await screen.findByText('잠시 후 다시 팔로우할 수 있어요')).toBeTruthy();
  fireEvent.press(await screen.findByRole('button', { name: '팔로우' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '팔로잉' })).toBeEnabled());
  fireEvent.press(screen.getByRole('button', { name: '팔로잉' }));
  expect(lastAlert(alert)?.[0]).toBe('Friend님을 언팔로우할까요?');
  act(() => lastAlert(alert)?.[2]?.[1]?.onPress?.());
  expect(await screen.findByRole('button', { name: '팔로우' })).toBeVisible();
});

it('removes a follower from the list after confirmation', async () => {
  relationshipScenario(true);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mount();
  fireEvent.press(screen.getByRole('tab', { name: '프로필' }));
  fireEvent.press(await screen.findByRole('button', { name: '팔로워 1' }));
  expect(await screen.findByRole('button', { name: '맞팔로우' })).toBeVisible();
  fireEvent(screen.getByRole('button', { name: 'Friend' }), 'accessibilityAction', {
    nativeEvent: { actionName: 'remove' },
  });
  expect(lastAlert(alert)?.[0]).toBe('Friend님을 팔로워에서 내보낼까요?');
  act(() => lastAlert(alert)?.[2]?.[1]?.onPress?.());
  expect(await screen.findByText('아직 팔로워가 없어요')).toBeVisible();
});

it('blocks a profile from search and opens the blocked list in settings', async () => {
  relationshipScenario();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((_opts, pick) => pick(2));
  mount();
  fireEvent.changeText(await openSearch(), 'friend');
  fireEvent.press(await screen.findByRole('button', { name: 'Friend' }));
  fireEvent.press(await screen.findByRole('button', { name: '프로필 메뉴' }));
  expect(lastAlert(alert)?.[0]).toBe('Friend님을 차단할까요?');
  act(() => lastAlert(alert)?.[2]?.[1]?.onPress?.());
  expect(await screen.findByText('찾는 사람이 없어요')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: '취소' }));
  fireEvent.press(screen.getByRole('button', { name: '설정' }));
  fireEvent.press(await screen.findByRole('button', { name: '차단한 사람' }));
  fireEvent.press(await screen.findByRole('button', { name: '차단 해제' }));
  expect(lastAlert(alert)?.[0]).toBe('Friend님의 차단을 풀까요?');
  act(() => lastAlert(alert)?.[2]?.[1]?.onPress?.());
  expect(await screen.findByText('차단한 사람이 없어요')).toBeVisible();
});

it('requires a reason and nonblank other details and can report and block', async () => {
  relationshipScenario();
  jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((_opts, pick) => pick(1));
  mount(true, 'friend');
  fireEvent.press(await screen.findByRole('button', { name: '프로필 메뉴' }));
  const submit = screen.getByRole('button', { name: '신고하기' });
  expect(submit).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: '기타' }));
  expect(submit).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('신고 이유를 적어 주세요'), 'Details');
  expect(submit).toBeEnabled();
  expect(screen.getByRole('switch', { name: '이 사람 차단하기' })).not.toBeChecked();
  fireEvent.press(screen.getByRole('switch', { name: '이 사람 차단하기' }));
  fireEvent.press(screen.getByRole('button', { name: '신고하기' }));
  await waitFor(() => expect(reportProfile).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByTestId('report-profile')).toBeNull());
  expect(reportProfile).toHaveBeenCalledWith(client, 'me', {
    targetUserId: 'other',
    reason: 'other',
    detail: 'Details',
    alsoBlock: true,
  });
});

it('shows the moderation notice on the owner’s edit screen', async () => {
  jest
    .mocked(fetchMySocialProfile)
    .mockResolvedValue({ ...mine, autoHiddenAt: 'now', bio: 'Own bio' });
  mount();
  fireEvent.press(screen.getByRole('tab', { name: '프로필' }));
  expect(await screen.findByText('Own bio')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: '프로필 편집' }));
  expect(
    await screen.findByText('신고가 접수되어 사진과 소개가 다른 사람에게 잠시 숨겨졌어요'),
  ).toBeVisible();
});
