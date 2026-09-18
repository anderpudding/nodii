import { describe, expect, it } from 'vitest';
import { compareVersion } from './version';

describe('compareVersion (SET-05)', () => {
  it.each([
    ['1.2.3', '1.2.3', 0],
    ['2.0.0', '1.99.99', 1],
    ['0.10.0', '0.9.9', 1],
    ['1.2.10', '1.2.9', 1],
    ['1.2.3', '2.0.0', -1],
    ['1.2.3', '1.3.0', -1],
    ['1.2.3', '1.2.4', -1],
  ])('%s와 %s를 숫자 단위로 비교한다', (a, b, expected) => {
    expect(compareVersion(a, b)).toBe(expected);
  });

  it.each(['1.2', 'v1.2.3', '1.2.3-beta', '01.2.3', '-1.2.3', '1.2.3.4', ''])(
    '잘못된 버전 %s를 거부한다',
    (version) => {
      expect(() => compareVersion(version, '1.0.0')).toThrow(RangeError);
      expect(() => compareVersion('1.0.0', version)).toThrow(RangeError);
    },
  );
});
