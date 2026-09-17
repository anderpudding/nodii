import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/** DB의 C collation과 같은 순서를 유지한다 (TODO-09). */
export function compareSortKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 기존 행의 키를 바꾸지 않고 두 항목 사이에 삽입한다 (TODO-06). */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b)
    throw new RangeError('Sort key bounds must be increasing');
  return generateKeyBetween(a, b);
}

/** 일괄 가져오기 항목에 서로 다른 맨 아래 키를 배정한다 (TODO-10). */
export function keysAfter(last: string | null, n: number): string[] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('Count must be a non-negative integer');
  return generateNKeysBetween(last, null, n);
}

/** 입력 배열을 정렬하거나 변경하지 않고 마지막 키를 찾는다. */
export function lastSortKey(items: readonly { sortKey: string }[]): string | null {
  return items.reduce<string | null>(
    (last, item) => (last === null || item.sortKey > last ? item.sortKey : last),
    null,
  );
}
