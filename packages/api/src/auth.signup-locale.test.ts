import { expect, it, vi } from 'vitest';
import { sendOtp } from './auth';
import type { NodiiClient } from './client';

it.each(['ko', 'en'] as const)(
  '신규 목표용 %s 언어를 OTP 가입 메타데이터로 전달한다',
  async (locale) => {
    const request = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { signInWithOtp: request } } as unknown as NodiiClient;
    await sendOtp(client, ' user@example.com ', locale);
    expect(request).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { shouldCreateUser: true, data: { signup_locale: locale } },
    });
  },
);
