import { Text } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { setLocale, t } from '@nodii/i18n';
import { ToastProvider, useToast } from './Toast';
import { BottomSheet } from './BottomSheet';
import { useLocale } from '../../lib/use-locale';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
function Content() {
  useLocale();
  const toast = useToast();
  return (
    <BottomSheet title={t('day.menu.open')} onClose={() => {}} testID="sheet">
      <Text
        testID="show"
        onPress={() =>
          toast(
            () => t('todo.deleted', { title: 'Read 20 pages', particle: '를' }),
            async () => {},
          )
        }
      >
        Show
      </Text>
    </BottomSheet>
  );
}
afterEach(cleanup);
it('열린 시트와 이미 떠 있는 토스트를 상태·실행 취소 수명 보존 중 번역한다', async () => {
  render(
    <ToastProvider>
      <Content />
    </ToastProvider>,
  );
  fireEvent.press(screen.getByTestId('show'));
  expect(screen.getByText("'Read 20 pages'를 지웠어요")).toBeTruthy();
  act(() => setLocale('en'));
  expect(screen.getByText('Day menu')).toBeTruthy();
  expect(screen.getByText("Deleted 'Read 20 pages'")).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
});
