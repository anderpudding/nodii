import { useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { parseInviteUrl } from '@nodii/core';

/** SOC-05: 로그인 화면이 바뀌어도 초대 토큰을 앱 메모리에 유지한다. */
export function useInviteReceiver(enabled: boolean | undefined) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let eventReceived = false;
    let stop: (() => void) | undefined;
    const accept = (urls: string[] | null) => {
      if (!active) return;
      const next = urls?.map(parseDesktopInviteUrl).filter(Boolean).at(-1);
      if (next) setToken(next);
    };
    void (async () => {
      const remove = await onOpenUrl((urls) => {
        eventReceived = true;
        accept(urls);
      });
      if (!active) return remove();
      stop = remove;
      const current = await getCurrent();
      if (!eventReceived) accept(current);
    })().catch((error: unknown) => {
      if (active) console.warn('Invite listener failed', error);
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);
  // 꺼진 상태에서 도착한 토큰은 다음 플래그 갱신으로 되살리지 않는다.
  if (enabled === false && token) setToken(null);
  return { token: enabled ? token : null, setToken };
}

/** D13: 다시 보이는 창에서 서버 플래그를 확인한다. */
export function onSocialForeground(refresh: () => void) {
  const check = () => {
    if (document.visibilityState !== 'hidden') refresh();
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  return () => {
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
  };
}

/** SOC-05: 서명 없는 개발 번들에서도 실제 OS 이벤트를 검증한다. */
export function parseDesktopInviteUrl(url: string) {
  return parseInviteUrl(
    import.meta.env.DEV || import.meta.env.MODE === 's2-dev'
      ? url.replace(/^nodii-dev:\/\/u\//, 'https://nodii.app/u/')
      : url,
  );
}
