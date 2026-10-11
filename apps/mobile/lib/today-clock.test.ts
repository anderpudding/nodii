import { afterEach, expect, it, vi } from 'vitest';
import { bindTodayClock, nextMidnightDelay } from './today-clock';
import { useUIStore } from '../src/stores/ui';
afterEach(() => {
  vi.useRealTimers();
  useUIStore.getState().reset();
});
it('자정과 여러 날 뒤 포그라운드 복귀에서 오늘을 갱신하고 타이머를 정리한다', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T06:59:59Z'));
  let change: (state: string) => void = () => {};
  const remove = vi.fn();
  const update = vi.fn();
  const dispose = bindTodayClock(
    {
      currentState: 'active',
      addEventListener: (_event, listener) => {
        change = listener;
        return { remove };
      },
    },
    () => 'America/Vancouver',
    update,
  );
  expect(update).toHaveBeenLastCalledWith('2026-10-10');
  vi.advanceTimersByTime(1000);
  expect(update).toHaveBeenLastCalledWith('2026-10-11');
  change('background');
  expect(vi.getTimerCount()).toBe(0);
  vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
  change('active');
  expect(update).toHaveBeenLastCalledWith('2026-10-14');
  expect(vi.getTimerCount()).toBe(1);
  dispose();
  expect(remove).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it('DST의 23/25시간 날에도 현지 자정까지의 실제 시간을 구한다', () => {
  // BC주는 2026년부터 가을 시계 되돌리기를 폐지했다.
  // 시간대 데이터 버전이 달라도 실제 DST 전환을 검사하도록 2025년 날짜를 쓴다.
  expect(nextMidnightDelay('America/Vancouver', new Date('2025-03-09T08:00:00Z'))).toBe(
    23 * 3600000,
  );
  expect(nextMidnightDelay('America/Vancouver', new Date('2025-11-02T07:00:00Z'))).toBe(
    25 * 3600000,
  );
});
it('오늘을 보고 있으면 선택 날짜도 새 오늘로 옮기고 과거 선택은 유지한다', () => {
  useUIStore.setState({ today: '2026-10-10', selectedDate: '2026-10-10' });
  useUIStore.getState().updateToday('2026-10-11');
  expect(useUIStore.getState().selectedDate).toBe('2026-10-11');
  useUIStore.getState().selectDate('2026-10-01');
  useUIStore.getState().updateToday('2026-10-12');
  expect(useUIStore.getState().selectedDate).toBe('2026-10-01');
});
