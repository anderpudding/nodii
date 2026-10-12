import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '@nodii/i18n';
import { ToastProvider } from '../../components/Toast';
import { FirstRunGuide, GUIDE_KEY } from './FirstRunGuide';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
function mount() {
  return render(
    <ToastProvider>
      <FirstRunGuide />
    </ToastProvider>,
  );
}
it.each(['mobile.guide.skip', 'mobile.guide.done'] as const)(
  '%s 뒤 다시 로그인해도 기기의 안내 확인을 유지한다',
  async (action) => {
    const view = mount();
    await screen.findByTestId('first-run-guide');
    expect(screen.getByText(t('mobile.guide.swipeDescription'))).toBeTruthy();
    expect(screen.getByText(t('mobile.guide.holdDescription'))).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: t(action) }));
    expect(screen.queryByTestId('first-run-guide')).toBeNull();
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(GUIDE_KEY, 'seen'));
    view.unmount();
    mount();
    await act(async () => {});
    expect(screen.queryByTestId('first-run-guide')).toBeNull();
  },
);
it('저장 실패를 알리면서 안내를 닫고 다음 실행에서 다시 볼 수 있다', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  mount();
  await screen.findByTestId('first-run-guide');
  fireEvent.press(screen.getByRole('button', { name: t('mobile.guide.skip') }));
  await screen.findByText(t('mobile.guide.storageFailed'));
  expect(screen.queryByTestId('first-run-guide')).toBeNull();
});
it('읽기 실패도 빈 화면 대신 닫을 수 있는 안내와 오류를 보여 준다', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage'));
  mount();
  await screen.findByTestId('first-run-guide');
  expect(screen.getByText(t('mobile.guide.storageFailed'))).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: t('mobile.guide.done') }));
  expect(screen.queryByTestId('first-run-guide')).toBeNull();
});
