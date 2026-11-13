import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { parseInviteUrl } from '@nodii/core';

/** SOC-05: 초기 링크와 실행 중 링크를 로그인보다 먼저 수신한다. */
export function useInviteReceiver(enabled: boolean | undefined) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let received = false;
    const accept = (url: string | null) => {
      const value = parseMobileInviteUrl(url);
      if (active && value) setToken(value);
    };
    const subscription = Linking.addEventListener('url', ({ url }) => {
      received = true;
      accept(url);
    });
    void Linking.getInitialURL()
      .then((url) => {
        if (!received) accept(url);
      })
      .catch((error: unknown) => {
        if (active) console.warn('Initial invite unavailable', error);
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  // 꺼진 상태에서 도착한 토큰은 다음 플래그 갱신으로 되살리지 않는다.
  if (enabled === false && token) setToken(null);
  return { token: enabled ? token : null, setToken };
}

/** D13: 전경으로 돌아왔을 때 원격 플래그를 다시 확인한다. */
export function onSocialForeground(refresh: () => void) {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') refresh();
  });
  return () => sub.remove();
}

/** SOC-05: 시뮬레이터 디버그 빌드에서만 같은 링크 수신 경로를 스킴으로 열 수 있다. */
export function parseMobileInviteUrl(url: string | null) {
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  return parseInviteUrl(
    dev ? (url?.replace(/^nodii:\/\/u\//, 'https://nodii.app/u/') ?? null) : url,
  );
}
