import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(() => {
  vi.restoreAllMocks();
});

it('렌더링 오류가 나면 빈 화면 대신 안내를 보여주고 다시 시도하면 복구한다', async () => {
  // React가 잡은 오류를 개발 모드에서 콘솔에 출력하므로 테스트 출력만 조용히 한다.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let shouldThrow = true;
  function Flaky() {
    if (shouldThrow) throw new Error('user@example.com token');
    return <p>하루 목록</p>;
  }
  render(
    <ErrorBoundary>
      <Flaky />
    </ErrorBoundary>,
  );

  expect(screen.getByRole('alert').textContent).toBe('문제가 생겼어요');
  expect(screen.queryByText(/user@example.com/)).toBeNull();

  shouldThrow = false;
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(screen.getByText('하루 목록')).toBeTruthy();
});
