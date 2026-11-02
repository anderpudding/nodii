import { keyBetween } from '@nodii/core';

/**
 * TODO-06: 같은 목표 안에서만 옮기고, 루틴도 정렬 키의 이웃으로 취급해 옮긴 할 일 한 행만 갱신한다.
 * 이웃 키가 같으면 `keyBetween`이 예외를 던지므로 호출부가 안내한다.
 */
export function reorderedTodoKey(
  items: readonly { id: string; sortKey: string }[],
  id: string,
  target: number,
): string | null {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0) return null;
  const to = Math.max(0, Math.min(target, items.length - 1));
  if (from === to) return null;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return keyBetween(next[to - 1]?.sortKey ?? null, next[to + 1]?.sortKey ?? null);
}
