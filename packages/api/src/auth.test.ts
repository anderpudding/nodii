import { describe, expect, it, vi } from 'vitest';
import { normalizeAuthError, sendOtp, signInReviewAccount, signOut, verifyOtp } from './auth';
import type { NodiiClient } from './client';

describe('인증 오류 정규화 (AUTH-07)', () => {
  it.each([
    [{ status: 429 }, 'rate_limited'],
    [{ code: 'over_email_send_rate_limit' }, 'rate_limited'],
    [
      { message: 'For security purposes, you can only request this after 60 seconds.' },
      'rate_limited',
    ],
    [{ code: 'otp_expired' }, 'expired'],
    [{ message: 'Token has expired' }, 'expired'],
    [{ message: 'Invalid OTP' }, 'invalid_code'],
    [{ code: 'invalid_credentials' }, 'invalid_code'],
    [new TypeError('Failed to fetch'), 'network'],
    [{ name: 'AuthRetryableFetchError' }, 'network'],
    [{ code: 'network' }, 'network'],
    [{ code: 'invalid_code' }, 'invalid_code'],
    [{ code: 'expired' }, 'expired'],
    [{ code: 'rate_limited' }, 'rate_limited'],
    [null, 'unknown'],
    [{ message: 'Unexpected database error' }, 'unknown'],
  ])('%j → %s', (error, code) => expect(normalizeAuthError(error)).toEqual({ code }));
});

function fakeClient() {
  const auth = {
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  return { client: { auth } as unknown as NodiiClient, auth };
}

it('이메일 가입 허용·검증 type·심사 계정 인자를 정확히 전달한다', async () => {
  const { client, auth } = fakeClient();
  await sendOtp(client, ' user@example.com ');
  await verifyOtp(client, ' user@example.com ', '123456');
  await signInReviewAccount(client, ' review@example.com ', 'demo-password');
  await signOut(client);
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'user@example.com',
    options: { shouldCreateUser: true },
  });
  expect(auth.verifyOtp).toHaveBeenCalledWith({
    email: 'user@example.com',
    token: '123456',
    type: 'email',
  });
  expect(auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'review@example.com',
    password: 'demo-password',
  });
  expect(auth.signOut).toHaveBeenCalledOnce();
});
it('서버 오류와 예외를 모두 정규화해서 호출자에게 전한다', async () => {
  const { client, auth } = fakeClient();
  auth.verifyOtp.mockResolvedValue({ error: { code: 'otp_expired' } });
  await expect(verifyOtp(client, 'user@example.com', '000000')).rejects.toEqual({
    code: 'expired',
  });
  auth.signInWithOtp.mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(sendOtp(client, 'user@example.com')).rejects.toEqual({ code: 'network' });
  auth.signOut.mockResolvedValue({ error: { status: 429 } });
  await expect(signOut(client)).rejects.toEqual({ code: 'rate_limited' });
});
