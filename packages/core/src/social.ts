export type DefaultVisibility = 'private' | 'mutual' | 'followers';

export interface SocialProfile {
  userId: string;
  handle: string;
  nickname: string;
  bio: string;
  avatarPath: string | null;
  searchable: boolean;
  handleChangedAt: string | null;
  autoHiddenAt: string | null;
  updatedAt: string;
}

export type HandleInvalidReason = 'length' | 'start' | 'characters' | 'dots' | 'trailingDot';
export const HANDLE_COOLDOWN_MS = 30 * 86_400_000;

/** SOC-02: 서버 검사 전에 형식만 확인하고 저장할 소문자 값을 돌려준다. */
export function validateHandle(
  raw: string,
):
  | { value: string; status: 'ok' }
  | { value: string; status: 'invalid'; reason: HandleInvalidReason } {
  const value = raw.toLowerCase();
  const reason =
    value.length < 3 || value.length > 20
      ? 'length'
      : !/^[a-z]/.test(value)
        ? 'start'
        : /[^a-z0-9_.]/.test(value)
          ? 'characters'
          : value.includes('..')
            ? 'dots'
            : value.endsWith('.')
              ? 'trailingDot'
              : null;
  return reason ? { value, status: 'invalid', reason } : { value, status: 'ok' };
}

/** SOC-01: DB와 같은 문자 수를 세고 앞뒤 공백을 저장하지 않는다. */
export function validateNickname(raw: string) {
  const value = raw.trim();
  const count = [...value].length;
  return { value, count, valid: count >= 1 && count <= 20 };
}

/** SOC-07: 줄바꿈을 통일한 뒤 DB와 같은 길이·줄 수를 검사한다. */
export function validateBio(raw: string) {
  const value = raw.replace(/\r\n/g, '\n');
  const count = [...value].length;
  return {
    value,
    count,
    valid: count <= 80 && !value.includes('\r') && value.split('\n').length <= 2,
  };
}

/** SOC-02: 변경할 수 있는 시각이 아직 남아 있을 때만 반환한다. */
export function handleChangeAvailableAt(
  handleChangedAt: string | null,
  now: number,
): number | null {
  if (!handleChangedAt) return null;
  const end = Date.parse(handleChangedAt) + HANDLE_COOLDOWN_MS;
  return end > now ? end : null;
}

/** SOC-05: 같은 공개 초대 주소를 두 플랫폼에서 공유한다. */
export function inviteUrl(token: string): string {
  return `https://nodii.app/u/${token}`;
}

/** SOC-05: S0에서 검증한 도메인과 단일 토큰 경로만 받는다. */
export function parseInviteUrl(url: string | null): string | null {
  return url?.match(/^https:\/\/nodii\.app\/u\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/)?.[1] ?? null;
}
