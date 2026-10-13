import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { hideAsync } from 'expo-splash-screen';
import { t } from '@nodii/i18n';
import { ErrorBoundary } from './ErrorBoundary';

jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(async () => {}) }));
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
it('렌더 오류 때 스플래시를 닫고 재시도로 화면을 다시 마운트한다', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  let failed = true;
  function Broken() {
    if (failed) throw new Error('render failed');
    return <Text>복구 완료</Text>;
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByText(t('mobile.error.title'))).toBeTruthy();
  await waitFor(() => expect(hideAsync).toHaveBeenCalled());
  failed = false;
  fireEvent.press(screen.getByRole('button', { name: t('common.tryAgain') }));
  expect(screen.getByText('복구 완료')).toBeTruthy();
});
