import type { NodiiClient } from './client';

export type AuthErrorCode = 'invalid_code' | 'expired' | 'rate_limited' | 'network' | 'unknown';
export interface AuthFailure {
  code: AuthErrorCode;
}

/** AUTH-07: 서버의 영문 오류를 화면에서 일관된 한국어 안내로 바꿀 수 있게 분류한다. */
export function normalizeAuthError(error: unknown): AuthFailure {
  const value = error && typeof error === 'object' ? error : {};
  const code = 'code' in value ? String(value.code) : '';
  const message = 'message' in value ? String(value.message).toLowerCase() : '';
  const status = 'status' in value ? Number(value.status) : 0;
  const name = 'name' in value ? String(value.name) : '';
  if (
    status === 429 ||
    /rate_limit|over_.*limit/.test(code) ||
    /rate limit|too many|after \d+ seconds/.test(message)
  )
    return { code: 'rate_limited' };
  if (
    code === 'network' ||
    name === 'AuthRetryableFetchError' ||
    /fetch|network|load failed|timeout/.test(message)
  )
    return { code: 'network' };
  // GoTrue는 틀린 코드에도 otp_expired를 반환한다. 구별 불가능한 응답은 새 코드 요청으로 안내한다.
  if (code === 'expired' || code === 'otp_expired' || /expired/.test(message))
    return { code: 'expired' };
  if (
    code === 'invalid_code' ||
    /otp_disabled|invalid_credentials/.test(code) ||
    /invalid.*(token|otp|code)|(token|otp|code).*invalid/.test(message)
  )
    return { code: 'invalid_code' };
  return { code: 'unknown' };
}

async function authenticate<T extends { error: unknown }>(request: () => Promise<T>): Promise<T> {
  try {
    const result = await request();
    if (result.error) throw result.error;
    return result;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

/** AUTH-01: 가입 여부와 관계없이 같은 OTP 흐름을 사용한다. */
export async function sendOtp(client: NodiiClient, email: string): Promise<void> {
  await authenticate(() =>
    client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }),
  );
}

/** AUTH-01: 이메일 코드 검증 뒤 SDK가 세션을 주입한 저장소에 보관한다. */
export async function verifyOtp(client: NodiiClient, email: string, token: string): Promise<void> {
  await authenticate(() => client.auth.verifyOtp({ email: email.trim(), token, type: 'email' }));
}

/** AUTH-08: 심사 계정에만 UI에서 노출하는 비밀번호 인증 경로다. */
export async function signInReviewAccount(
  client: NodiiClient,
  email: string,
  password: string,
): Promise<void> {
  await authenticate(() => client.auth.signInWithPassword({ email: email.trim(), password }));
}

/** AUTH-03: 서버 세션 해제가 실패하면 로컬 정리 전에 호출자에게 알린다. */
export async function signOut(client: NodiiClient): Promise<void> {
  await authenticate(() => client.auth.signOut());
}
