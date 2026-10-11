import { describe, expect, it, vi } from 'vitest';
import { createRowCoordinator, swipeOutcome } from './swipe';

describe('거리 임계값', () => {
  it.each([0, 50, -50, -143])('짧은 밀기 %s는 되돌린다', (distance) => {
    expect(swipeOutcome(distance, 360, 144)).toBe('close');
  });
  it('칸 전체를 드러내면 버튼을 누를 수 있게 열어 둔다', () => {
    expect(swipeOutcome(-144, 360, 144)).toBe('open');
    expect(swipeOutcome(-233, 360, 144)).toBe('open');
  });
  it('행의 65%부터 바로 실행하고 너비가 없으면 실행하지 않는다', () => {
    expect(swipeOutcome(234, 360, 144)).toBe('leading');
    expect(swipeOutcome(-234, 360, 144)).toBe('trailing');
    expect(swipeOutcome(200, 0, 144)).toBe('close');
  });
  it('다른 행만 닫고 재활용된 이전 행의 정리는 새 행을 닫지 않는다', () => {
    const coordinator = createRowCoordinator();
    const first = vi.fn();
    const second = vi.fn();
    coordinator.activate('one', first);
    coordinator.activate('one', first);
    expect(first).not.toHaveBeenCalled();
    coordinator.activate('two', second);
    expect(first).toHaveBeenCalledOnce();
    coordinator.release('one');
    coordinator.close();
    expect(second).toHaveBeenCalledOnce();
  });
});
