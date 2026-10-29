import { afterEach, expect, it } from 'vitest';
import { formatList, ordinal } from './format-list';
import { setLocale } from './locale';

afterEach(() => setLocale('ko'));

it('한국어 목록을 유지하고 영어는 항목 수에 맞는 접속사를 쓴다', () => {
  expect(formatList(['월', '수', '금'])).toBe('월·수·금');
  setLocale('en');
  expect(formatList([])).toBe('');
  expect(formatList(['Tue'])).toBe('Tue');
  expect(formatList(['1st', '15th'])).toBe('1st and 15th');
  expect(formatList(['Mon', 'Wed', 'Fri'])).toBe('Mon, Wed, and Fri');
  expect(formatList(['월', '수'], 'ko')).toBe('월·수');
});

it('일자 서수는 십대와 20·30일 경계도 처리한다', () => {
  const days = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31];
  expect(days.map((n) => ordinal(n))).toEqual(days.map(String));
  setLocale('en');
  expect(days.map((n) => ordinal(n))).toEqual([
    '1st',
    '2nd',
    '3rd',
    '4th',
    '11th',
    '12th',
    '13th',
    '21st',
    '22nd',
    '23rd',
    '31st',
  ]);
  expect(ordinal(31, 'ko')).toBe('31');
});
