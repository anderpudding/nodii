import { afterEach, expect, it, vi } from 'vitest';
import { todayISO } from '@nodii/core';
import { startTodayClock } from './today';
import { useUIStore } from '../stores/ui';

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  vi.useRealTimers();
});
it.each([true, false])(
  '자정에 today 갱신, 오늘을 보고 있을 때만 선택 이동 (%s)',
  (viewingToday) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 23, 59));
    useUIStore.setState({
      today: '2026-09-19',
      selectedDate: viewingToday ? '2026-09-19' : '2026-09-18',
    });
    stop = startTodayClock();
    vi.advanceTimersByTime(60_000);
    expect(useUIStore.getState().today).toBe('2026-09-20');
    expect(useUIStore.getState().selectedDate).toBe(viewingToday ? '2026-09-20' : '2026-09-18');
  },
);
it.each(['focus', 'visibilitychange'])(
  '잠자기와 시간대 변경 후 %s에서 즉시 재계산한다',
  (event) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 12));
    useUIStore.setState({ today: '2026-09-19', selectedDate: '2026-09-19' });
    stop = startTodayClock();
    vi.setSystemTime(new Date(2026, 8, 21, 12));
    (event === 'focus' ? window : document).dispatchEvent(new Event(event));
    expect(useUIStore.getState().today).toBe(
      todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date()),
    );
    expect(useUIStore.getState().selectedDate).toBe('2026-09-21');
    stop();
    vi.setSystemTime(new Date(2026, 8, 22, 12));
    vi.advanceTimersByTime(60_000);
    expect(useUIStore.getState().today).toBe('2026-09-21');
  },
);
