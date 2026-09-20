import { useEffect } from 'react';
import { todayISO } from '@nodii/core';
import { useUIStore } from '../stores/ui';

/** 시간대·DST·잠자기 복귀를 현재 기기 시각으로 재계산한다. */
export function startTodayClock(): () => void {
  const refresh = () =>
    useUIStore
      .getState()
      .updateToday(todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date()));
  refresh();
  const timer = window.setInterval(refresh, 60_000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
/** 인증된 화면이 살아 있는 동안만 오늘 날짜를 갱신한다. */
export function useTodayClock(): void {
  useEffect(startTodayClock, []);
}
