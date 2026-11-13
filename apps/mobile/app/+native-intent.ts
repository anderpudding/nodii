import { parseMobileInviteUrl } from '../src/features/social/invite-receiver';

/** SOC-05: 원본 URL은 Expo Linking에서 받고 라우터는 기존 로그인 화면을 유지한다. */
export function redirectSystemPath({ path }: { path: string }) {
  return parseMobileInviteUrl(path) ? '/' : path;
}
