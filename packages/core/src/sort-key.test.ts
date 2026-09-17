import { describe, expect, it } from 'vitest';
import { compareSortKey, keyBetween, keysAfter, lastSortKey } from './sort-key';

describe('fractional indexing (TODO-06, GOAL-04)', () => {
  it('처음·앞·사이·끝 삽입에서도 기존 키를 바꾸지 않는다', () => {
    expect(keyBetween(null, null)).toBe('a0');
    expect(keyBetween('a0', 'a1')).toBe('a0V');
    expect(keyBetween(null, 'a0') < 'a0').toBe(true);
    expect(keyBetween('a1', null) > 'a1').toBe(true);
    let upper = 'a1';
    for (let i = 0; i < 100; i++) {
      const key = keyBetween('a0', upper);
      expect(key > 'a0' && key < upper).toBe(true);
      upper = key;
    }
  });
  it('여러 키 생성, 빈 목록, 최대 키를 처리한다', () => {
    expect(keysAfter(null, 3)).toEqual(['a0', 'a1', 'a2']);
    expect(keysAfter('a1', 2)).toEqual(['a2', 'a3']);
    expect(keysAfter(null, 0)).toEqual([]);
    expect(lastSortKey([])).toBeNull();
    expect(lastSortKey([{ sortKey: 'a1' }, { sortKey: 'Zz' }, { sortKey: 'a0' }])).toBe('a1');
  });
  it('로케일과 관계없이 바이트 순서로 비교한다', () => {
    expect(compareSortKey('Zz', 'a0')).toBe(-1);
    expect(compareSortKey('a0', 'Zz')).toBe(1);
    expect(compareSortKey('a0', 'a0')).toBe(0);
  });
  it('잘못된 키 구간과 개수는 거부한다', () => {
    expect(() => keyBetween('a1', 'a0')).toThrow();
    for (const n of [-1, NaN, Infinity, 0.5]) expect(() => keysAfter(null, n)).toThrow(RangeError);
  });
});
