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
