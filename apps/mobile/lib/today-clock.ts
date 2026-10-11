import { todayISO } from '@nodii/core';

interface AppStateSource {
  currentState: string | null;
  addEventListener(event: 'change', listener: (state: string) => void): { remove(): void };
}
/** 자정(DST 포함)을 절대 시각에서 찾아 로컬 Date 날짜 연산을 피한다. */
export function nextMidnightDelay(timeZone: string, now: Date): number {
  const start = now.getTime();
  const today = todayISO(timeZone, now);
  let low = start;
  let high = start + 26 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (todayISO(timeZone, new Date(middle)) === today) low = middle;
    else high = middle;
  }
  return high - start;
}
/** MOB-02: 자정과 포그라운드 복귀에 다시 계산하고 백그라운드 타이머는 정리한다. */
export function bindTodayClock(
  appState: AppStateSource,
  timeZone: () => string,
  update: (date: string) => void,
  now: () => Date = () => new Date(),
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function refresh() {
    clearTimeout(timer);
    const instant = now();
    const zone = timeZone();
    update(todayISO(zone, instant));
    timer = setTimeout(refresh, nextMidnightDelay(zone, instant));
  }
  if (appState.currentState === 'active') refresh();
  const subscription = appState.addEventListener('change', (state) => {
    clearTimeout(timer);
    if (state === 'active') refresh();
  });
  return () => {
    clearTimeout(timer);
    subscription.remove();
  };
}
