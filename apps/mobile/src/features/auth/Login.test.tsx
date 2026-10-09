import type * as Api from '@nodii/api';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { sendOtp, signInReviewAccount, verifyOtp, type NodiiClient } from '@nodii/api';
import { t } from '@nodii/i18n';
vi.mock('@nodii/api', async (original) => ({
  ...(await original<typeof Api>()),
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInReviewAccount: vi.fn(),
}));
import { Login } from './Login';
const client = {} as NodiiClient;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sendOtp).mockResolvedValue();
  vi.mocked(verifyOtp).mockResolvedValue();
  vi.mocked(signInReviewAccount).mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('이메일 발송·6자리 자동 제출·오류 후 다시 입력을 처리한다', async () => {
  vi.mocked(verifyOtp).mockRejectedValueOnce({ code: 'invalid_code' });
  render(<Login client={client} reviewAccountEmail="" />);
  fireEvent.change(screen.getByLabelText(t('auth.email')), {
    target: { value: ' A@EXAMPLE.COM ' },
  });
  fireEvent.click(screen.getByRole('button', { name: t('auth.send') }));
  await screen.findByLabelText(t('auth.code.label'));
  expect(sendOtp).toHaveBeenCalledWith(client, 'a@example.com');
  const input = screen.getByLabelText(t('auth.code.label'));
  expect(input.getAttribute('autocomplete')).toBe('one-time-code');
  fireEvent.change(input, { target: { value: '123456' } });
  await screen.findByText(t('auth.error.invalid_code'));
  expect(verifyOtp).toHaveBeenCalledTimes(1);
  expect((input as HTMLInputElement).value).toBe('');
  fireEvent.change(input, { target: { value: '654321' } });
  await waitFor(() =>
    expect(verifyOtp).toHaveBeenLastCalledWith(client, 'a@example.com', '654321'),
  );
});
it('재전송은 60초 이후만 허용하고 다른 이메일에서 돌아와도 제한한다', async () => {
  vi.useFakeTimers();
  render(<Login client={client} reviewAccountEmail="" />);
  fireEvent.change(screen.getByLabelText(t('auth.email')), { target: { value: 'a@example.com' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: t('auth.send') })));
  const resend = screen.getByRole('button', { name: t('auth.resendCountdown', { seconds: 60 }) });
  expect(resend.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: t('auth.changeEmail') }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: t('auth.send') })));
  expect(sendOtp).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTime(60000));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: t('auth.resend') })));
  expect(sendOtp).toHaveBeenCalledTimes(2);
});
it('설정된 심사 이메일만 비밀번호를 표시하고 OTP 요청 없이 로그인한다', async () => {
  render(<Login client={client} reviewAccountEmail="review@example.com" />);
  expect(screen.queryByLabelText(t('auth.password'))).toBeNull();
  fireEvent.change(screen.getByLabelText(t('auth.email')), {
    target: { value: ' REVIEW@EXAMPLE.COM ' },
  });
  fireEvent.change(screen.getByLabelText(t('auth.password')), {
    target: { value: 'review-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: t('auth.login') }));
  await waitFor(() =>
    expect(signInReviewAccount).toHaveBeenCalledWith(client, 'review@example.com', 'review-secret'),
  );
  expect(sendOtp).not.toHaveBeenCalled();
});
it('심사 설정이 없거나 이메일을 바꾸면 비밀번호를 노출하지 않는다', () => {
  const { rerender } = render(<Login client={client} reviewAccountEmail="" />);
  fireEvent.change(screen.getByLabelText(t('auth.email')), {
    target: { value: 'review@example.com' },
  });
  expect(screen.queryByLabelText(t('auth.password'))).toBeNull();
  rerender(<Login client={client} reviewAccountEmail="review@example.com" />);
  expect(screen.getByLabelText(t('auth.password'))).toBeTruthy();
  fireEvent.change(screen.getByLabelText(t('auth.email')), {
    target: { value: 'other@example.com' },
  });
  expect(screen.queryByLabelText(t('auth.password'))).toBeNull();
});
