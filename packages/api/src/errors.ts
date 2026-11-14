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
  | 'reserved'
  | 'banned'
  | 'handle_cooldown'
  | 'handle_held'
  | 'taken'
  | 'network'
  | 'unknown'
  | 'rate_limited'
  | 'blocked'
  | 'not_found'
  | 'already_following'
  | 'not_visible'
  | 'not_done'
  | 'own_item';

/** SOC-02: 서버 원문 대신 제한된 코드만 화면에 전달한다. */
export function socialErrorCode(error: unknown, operation?: 'follow'): SocialErrorCode {
  if (!error || typeof error !== 'object') return 'unknown';
  const { code, message, name } = error as { code?: unknown; message?: unknown; name?: unknown };
  if (code === '23505') return operation === 'follow' ? 'already_following' : 'taken';
  if (code === '23503' || code === 'PGRST116') return 'not_found';
  if (code === 'P0001' && message === 'not_available') return 'not_found';
  if (
    code === 'P0001' &&
    (message === 'rate_limited' ||
      message === 'not_visible' ||
      message === 'not_done' ||
      message === 'own_item' ||
      message === 'blocked' ||
      message === 'not_found' ||
      message === 'already_following' ||
      message === 'reserved' ||
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
