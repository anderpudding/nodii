/** DB 내부 문구 대신 앱에서 처리할 안정적인 오류 코드를 제공한다. */
export function mapDataError(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    error.code === 'P0001' &&
    error.message === 'at least one active goal is required'
  ) {
    return { code: 'last_active_goal' };
  }
  return error;
}

export type SocialErrorCode =
  'reserved' | 'banned' | 'handle_cooldown' | 'handle_held' | 'taken' | 'network' | 'unknown';

/** SOC-02: 서버 원문 대신 제한된 코드만 화면에 전달한다. */
export function socialErrorCode(error: unknown): SocialErrorCode {
  if (!error || typeof error !== 'object') return 'unknown';
  const { code, message, name } = error as { code?: unknown; message?: unknown; name?: unknown };
  if (code === '23505') return 'taken';
  if (
    code === 'P0001' &&
    (message === 'reserved' ||
      message === 'banned' ||
      message === 'handle_cooldown' ||
      message === 'handle_held')
  )
    return message;
  if (
    code === 'offline' ||
    name === 'AbortError' ||
    name === 'StorageRetryableError' ||
    (typeof message === 'string' &&
      /network|failed to fetch|load failed|fetch failed|offline/i.test(message))
  )
    return 'network';
  return 'unknown';
}
