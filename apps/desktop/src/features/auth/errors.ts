import { t } from '@nodii/i18n';
import { normalizeAuthError } from '@nodii/api';

/** AUTH-07: 인증 흐름에 맞는 행동 가능한 한국어 문구를 제공한다. */
export function authErrorMessage(error: unknown, reviewAccount = false): string {
  const code = normalizeAuthError(error).code;
  if (reviewAccount && code === 'invalid_code') return t('auth.error.review');
  const keys = {
    invalid_code: 'auth.error.invalid_code',
    expired: 'auth.error.expired',
    rate_limited: 'auth.error.rate_limited',
    network: 'auth.error.network',
    unknown: 'auth.error.unknown',
  } as const;
  return t(keys[code]);
}
