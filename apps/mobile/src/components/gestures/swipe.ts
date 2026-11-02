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

/** GOAL-04/TODO-06: 길게 눌러 끈 거리를 실측한 행 중심과 비교해 놓일 위치를 고른다. */
export function droppedRowIndex(heights: readonly number[], source: number, distance: number) {
  let top = 0;
  const centers = heights.map((height) => {
    const center = top + height / 2;
    top += height;
    return center;
  });
  const destination = (centers[source] ?? 0) + distance;
  let target = source;
  for (let i = 0; i < centers.length; i++) {
    if (i < source && destination <= centers[i]!) return i;
    if (i > source && destination >= centers[i]!) target = i;
  }
  return target;
}
