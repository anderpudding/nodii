import { keyBetween } from '@nodii/core';

/** 화면의 같은 목록 안에서만 이동하고 루틴도 정렬 키의 이웃으로 취급한다. */
export function reorderedKey(
  items: { id: string; sortKey: string }[],
  id: string,
  overId: string,
): string | null {
  const from = items.findIndex((item) => item.id === id);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  // 동시 편집으로 두 이웃 키가 같다면 한 행만 갱신하는 규칙을 보존하고 재시도를 안내한다.
  return keyBetween(next[to - 1]?.sortKey ?? null, next[to + 1]?.sortKey ?? null);
}
