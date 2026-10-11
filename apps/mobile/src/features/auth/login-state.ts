import { normalizeAuthError, type AuthErrorCode } from '@nodii/api';
import { OTP_RESEND_COOLDOWN_SECONDS } from '@nodii/core';
import { t, type MessageKey } from '@nodii/i18n';

export interface LoginState {
  step: 'email' | 'code' | 'success';
  email: string;
  password: string;
  codeEmail: string;
  token: string;
  pending: boolean;
  error: string;
  deadlines: Readonly<Record<string, number>>;
}
export const initialLoginState: LoginState = {
  step: 'email',
  email: '',
  password: '',
  codeEmail: '',
  token: '',
  pending: false,
  error: '',
  deadlines: {},
};
export type LoginAction =
  | { type: 'email'; value: string }
  | { type: 'password' | 'token'; value: string }
  | { type: 'begin' }
  | { type: 'sent'; email: string; now: number }
  | { type: 'code'; email: string }
  | { type: 'failed'; error: string; rateLimitedEmail?: string; now: number }
  | { type: 'success' }
  | { type: 'changeEmail' };

/** AUTH-08: 설정이 비어 있으면 일반 코드 인증만 제공한다. */
export function isReviewEmail(email: string, reviewEmail: string): boolean {
  return !!reviewEmail.trim() && email.trim().toLowerCase() === reviewEmail.trim().toLowerCase();
}
/** AUTH-07: 앱 복귀 때도 실제 경과 시간으로 재전송 간격을 지킨다. */
export function cooldownRemaining(state: LoginState, email: string, now: number): number {
  return Math.max(0, Math.ceil(((state.deadlines[email.trim().toLowerCase()] ?? 0) - now) / 1000));
}
/** AUTH-01/07: 이메일 변경에도 주소별 발송 제한을 유지한다. */
export function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case 'email':
      return { ...state, email: action.value, password: '', error: '' };
    case 'password':
      return { ...state, password: action.value, error: '' };
    case 'token':
      return { ...state, token: action.value.replace(/\D/g, '').slice(0, 6), error: '' };
    case 'begin':
      return { ...state, pending: true, error: '' };
    case 'sent':
      return {
        ...state,
        step: 'code',
        codeEmail: action.email,
        token: '',
        pending: false,
        error: '',
        deadlines: {
          ...state.deadlines,
          [action.email]: action.now + OTP_RESEND_COOLDOWN_SECONDS * 1000,
        },
      };
    case 'code':
      return { ...state, step: 'code', codeEmail: action.email, token: '', error: '' };
    case 'failed':
      return {
        ...state,
        pending: false,
        error: action.error,
        token: '',
        deadlines: action.rateLimitedEmail
          ? {
              ...state.deadlines,
              [action.rateLimitedEmail]: action.now + OTP_RESEND_COOLDOWN_SECONDS * 1000,
            }
          : state.deadlines,
      };
    case 'success':
      return { ...state, step: 'success', pending: false, error: '', password: '', token: '' };
    case 'changeEmail':
      return { ...state, step: 'email', codeEmail: '', token: '', error: '' };
  }
}
const errorKeys: Record<AuthErrorCode, MessageKey> = {
  invalid_code: 'auth.error.invalid_code',
  expired: 'auth.error.expired',
  rate_limited: 'auth.error.rate_limited',
  network: 'auth.error.network',
  unknown: 'auth.error.unknown',
};
/** AUTH-07: 데스크톱과 동일한 안내를 공유 카탈로그에서 읽는다. */
export function authErrorMessage(error: unknown, review = false): string {
  const code = normalizeAuthError(error).code;
  return t(review && code === 'invalid_code' ? 'auth.error.review' : errorKeys[code]);
}
