import { normalizeAuthError } from '@nodii/api';

/** AUTH-07: 인증 흐름에 맞는 행동 가능한 한국어 문구를 제공한다. */
export function authErrorMessage(error: unknown, reviewAccount = false): string {
  const code = normalizeAuthError(error).code;
  if (reviewAccount && code === 'invalid_code')
    return '이메일이나 비밀번호가 맞지 않아요. 다시 확인해 주세요.';
  return {
    invalid_code: '코드가 맞지 않아요. 메일의 숫자를 다시 확인해 주세요.',
    expired: '코드 유효 시간(10분)이 지났어요. 새 코드를 받아 주세요.',
    rate_limited: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
    network: '인터넷 연결을 확인하고 다시 시도해 주세요.',
    unknown: '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  }[code];
}
