import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

function webUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
export const links = [
  { label: '개인정보처리방침', url: webUrl(import.meta.env.VITE_PRIVACY_URL) },
  { label: '이용약관', url: webUrl(import.meta.env.VITE_TERMS_URL) },
  { label: '지원 페이지', url: webUrl(import.meta.env.VITE_SUPPORT_URL) },
];
/** SET-07: 네이티브에서는 허용된 opener로 외부 브라우저를 연다. */
export async function openLink(url: string) {
  if (isTauri()) await openUrl(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
