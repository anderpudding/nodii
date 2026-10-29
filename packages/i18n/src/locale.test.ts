import { afterEach, expect, it, vi } from 'vitest';
import { getLocale, intlLocale, resolveLocale, setLocale, subscribeLocale } from './locale';
import { formatISODate, weekdayName } from './format-date';
import { ko } from './catalog.ko';
import { createTranslator } from './translate';

afterEach(() => setLocale('ko'));

it.each([
  [['ko-KR'], 'ko'],
  [['ko'], 'ko'],
  [['KO-kr'], 'ko'],
  [['en-CA', 'ko-KR'], 'en'],
  [['ja-JP'], 'en'],
  [[], 'en'],
] as const)('첫 시스템 선호 %j를 %s로 결정한다', (languages, locale) => {
  expect(resolveLocale('system', languages)).toBe(locale);
});

it('명시한 언어는 시스템 선호와 관계없다', () => {
  expect(resolveLocale('ko', ['en-US'])).toBe('ko');
  expect(resolveLocale('en', ['ko-KR'])).toBe('en');
  expect(intlLocale('ko')).toBe('ko-KR');
  expect(intlLocale('en')).toBe('en-US');
});

it('변경만 알리고 구독을 해제한다', () => {
  expect(getLocale()).toBe('ko');
  const listener = vi.fn();
  const unsubscribe = subscribeLocale(listener);
  setLocale('ko');
  expect(listener).not.toHaveBeenCalled();
  setLocale('en');
  expect(listener).toHaveBeenCalledOnce();
  unsubscribe();
  setLocale('ko');
  expect(listener).toHaveBeenCalledOnce();
});

it('영어 누락 키는 자리표시자 규칙을 유지한 한국어로 대체한다', () => {
  const t = createTranslator({ ko, en: { 'settings.language': 'Language' } });
  setLocale('en');
  expect(t('settings.language')).toBe('Language');
  expect(t('goal.total', { count: 2 })).toBe('목표 2개');
  expect(t('mobile.spike.version')).toBe('버전 {version}');
});

it('주입한 영어 복수형을 우선하고 없으면 기본 키를 쓴다', () => {
  const translate = createTranslator({
    ko,
    en: {
      'goal.total': '{count} goals (base)',
      'goal.total_one': '{count} goal',
      'goal.total_other': '{count} goals',
      'routine.running': '{count} routines',
    },
  });
  setLocale('en');
  expect(translate('goal.total', { count: 1 })).toBe('1 goal');
  expect(translate('goal.total', { count: 2 })).toBe('2 goals');
  expect(translate('goal.total', { count: '1' })).toBe('1 goals (base)');
  expect(translate('routine.running', { count: 2 })).toBe('2 routines');
  setLocale('ko');
  expect(translate('goal.total', { count: 1 })).toBe('목표 1개');
  expect(translate('goal.total', { count: 2 })).toBe('목표 2개');
});

it('UTC 날짜와 요일은 현재 로케일을 따르고 명시 로케일은 우선한다', () => {
  const options = { month: 'long', day: 'numeric', weekday: 'short' } as const;
  expect(formatISODate('2026-10-28', options)).toBe('10월 28일 (수)');
  const days = [0, 1, 2, 3, 4, 5, 6] as const;
  expect(days.map((day) => weekdayName(day, 'short'))).toEqual([
    '일',
    '월',
    '화',
    '수',
    '목',
    '금',
    '토',
  ]);
  expect(days.map((day) => weekdayName(day, 'long'))).toEqual([
    '일요일',
    '월요일',
    '화요일',
    '수요일',
    '목요일',
    '금요일',
    '토요일',
  ]);
  setLocale('en');
  expect(formatISODate('2026-10-28', options)).toBe('Wed, October 28');
  expect(days.map((day) => weekdayName(day, 'short'))).toEqual([
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ]);
  expect(weekdayName(1, 'long')).toBe('Monday');
  expect(formatISODate('2026-10-28', options, 'ko')).toBe('10월 28일 (수)');
  expect(weekdayName(1, 'long', 'ko')).toBe('월요일');
  setLocale('ko');
  expect(formatISODate('2026-10-28', { ...options, timeZone: 'America/Vancouver' })).toBe(
    '10월 28일 (수)',
  );
});
