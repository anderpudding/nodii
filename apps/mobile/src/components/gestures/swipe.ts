export const swipeRules = {
  horizontalActivation: 12,
  verticalFailure: 8,
  commitRatio: 0.65,
  longPressMs: 400,
} as const;

export type SwipeOutcome = 'close' | 'open' | 'leading' | 'trailing';
/** MOB-01: 속도만으로 파괴적 동작을 실행하지 않고 실제 이동 거리로 판정한다. */
export function swipeOutcome(distance: number, width: number, railWidth: number): SwipeOutcome {
  'worklet';
  if (width <= 0) return 'close';
  if (distance >= width * swipeRules.commitRatio) return 'leading';
  if (distance <= -width * swipeRules.commitRatio) return 'trailing';
  return distance <= -railWidth ? 'open' : 'close';
}

/** MOB-01: 다음 행의 밀기를 시작하면 이전 행만 즉시 닫는다. */
export function createRowCoordinator() {
  let current: { id: string; close(): void } | null = null;
  return {
    activate(id: string, close: () => void) {
      if (current?.id !== id) current?.close();
      current = { id, close };
    },
    release(id: string) {
      if (current?.id === id) current = null;
    },
    close() {
      current?.close();
      current = null;
    },
  };
}
