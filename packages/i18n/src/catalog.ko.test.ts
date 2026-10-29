import { describe, expect, it } from 'vitest';
import { ko, type MessageKey } from './catalog.ko';
import { t, type MessageParams } from './translate';

describe('한국어 카탈로그', () => {
  it('모든 키에 빈 문자열이 아닌 문구가 있다', () => {
    for (const [key, message] of Object.entries(ko)) {
      expect(message.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('자리표시자는 중괄호 안에 영문과 숫자만 쓴다', () => {
    for (const [key, message] of Object.entries(ko)) {
      expect(message.replace(/\{[A-Za-z0-9]+\}/g, ''), key).not.toMatch(/[{}]/);
    }
  });

  const cases: [MessageKey, MessageParams, string][] = [
    ['goal.delete.confirm', { name: '공부' }, '‘공부’ 목표를 삭제할까요?'],
    ['routine.weekly.days', { days: '월·수' }, '매주 월·수'],
    ['routine.everyWeeks.days', { every: 2, days: '화·목' }, '2주마다 화·목'],
    ['routine.monthly.days', { days: '1·31' }, '매월 1·31일'],
    ['routine.everyMonths.days', { every: 3, days: '31' }, '3개월마다 31일'],
    ['day.summary.today', { total: 6, done: 2 }, '오늘, 6개 중 2개 끝냄'],
    [
      'settings.delete.contents',
      { goals: 1, todos: 2, routines: 3 },
      '목표 1개 · 할 일 2개 · 루틴 3개와 모든 완료 기록이 삭제돼요.',
    ],
  ];

  it.each(cases)('%s의 문장 전체를 치환한다', (key, params, expected) => {
    expect(t(key, params)).toBe(expected);
  });
});
