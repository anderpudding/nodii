import { describe, expect, it } from 'vitest';
import { t } from '@nodii/i18n';
import {
  authErrorMessage,
  cooldownRemaining,
  initialLoginState,
  isReviewEmail,
  loginReducer,
} from './login-state';

describe('로그인 상태 전이', () => {
  it('이메일 → 발송 → 코드 → 실패 → 성공으로 진행한다', () => {
    let state = loginReducer(initialLoginState, { type: 'email', value: 'a@example.com' });
    state = loginReducer(state, { type: 'begin' });
    expect(state.pending).toBe(true);
    state = loginReducer(state, { type: 'sent', email: 'a@example.com', now: 1000 });
    expect(state.step).toBe('code');
    state = loginReducer(state, { type: 'token', value: '123456' });
    state = loginReducer(state, { type: 'failed', error: 'failed', now: 2000 });
    expect(state).toMatchObject({ step: 'code', token: '', pending: false, error: 'failed' });
    state = loginReducer(state, { type: 'success' });
    expect(state).toMatchObject({ step: 'success', token: '', password: '', error: '' });
  });
  it('6자리 숫자만 유지한다', () => {
    expect(loginReducer(initialLoginState, { type: 'token', value: '12a34567' }).token).toBe(
      '123456',
    );
  });
  it('다른 이메일로 갔다 돌아와도 쿨다운은 주소별로 남는다', () => {
    let state = loginReducer(initialLoginState, {
      type: 'sent',
      email: 'a@example.com',
      now: 1000,
    });
    state = loginReducer(state, { type: 'changeEmail' });
    expect(state.step).toBe('email');
    expect(cooldownRemaining(state, ' A@EXAMPLE.COM ', 1001)).toBe(60);
    expect(cooldownRemaining(state, 'b@example.com', 1001)).toBe(0);
    expect(cooldownRemaining(state, 'a@example.com', 61000)).toBe(0);
  });
  it('서버 과다 요청도 재전송 시간을 다시 시작한다', () => {
    const state = loginReducer(initialLoginState, {
      type: 'failed',
      error: 'limited',
      rateLimitedEmail: 'a@example.com',
      now: 5000,
    });
    expect(cooldownRemaining(state, 'a@example.com', 35000)).toBe(30);
  });
  it.each([
    ['review@example.com', '', false],
    [' REVIEW@EXAMPLE.COM ', 'review@example.com', true],
    ['other@example.com', 'review@example.com', false],
    ['', ' ', false],
  ])('심사 계정은 명시된 이메일만 허용한다', (email, configured, expected) => {
    expect(isReviewEmail(email, configured)).toBe(expected);
  });
  it('이메일이 바뀌면 이전 심사 비밀번호를 비운다', () => {
    const state = loginReducer(
      { ...initialLoginState, password: 'secret' },
      { type: 'email', value: 'other@example.com' },
    );
    expect(state.password).toBe('');
  });
  it.each(['invalid_code', 'expired', 'rate_limited', 'network', 'unknown'] as const)(
    '오류 %s를 공유 문구로 표시한다',
    (code) => {
      expect(authErrorMessage({ code })).toBe(t(`auth.error.${code}`));
    },
  );
  it('심사 계정 오류는 비밀번호 안내를 제공한다', () => {
    expect(authErrorMessage({ code: 'invalid_code' }, true)).toBe(t('auth.error.review'));
  });
});
