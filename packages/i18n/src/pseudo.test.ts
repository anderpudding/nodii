import { afterEach, expect, it } from 'vitest';
import { pseudoLocalize, setPseudoLocale } from './pseudo';
import { setLocale } from './locale';
import { t } from './translate';

afterEach(() => {
  setLocale('ko');
  setPseudoLocale(false);
});

it('자리표시자 이름을 보존하고 악센트와 약 40% 확장을 더한다', () => {
  expect(pseudoLocalize('Save {name}')).toBe('[Šáṽé {name}~~]');
  const result = pseudoLocalize('abcdefghijklmnopqrstuvwxyz');
  expect(result).not.toMatch(/[a-z]/i);
  expect(result.length - 2).toBe(26 + Math.ceil(26 * 0.4));
});

it('영어에만 치환 전에 적용해 사용자 이름과 숫자는 변하지 않는다', () => {
  setPseudoLocale(true);
  expect(t('goal.row', { name: 'My goal', todos: 1, routines: 2 })).toBe(
    'My goal, 할 일 1개, 루틴 2개',
  );
  setLocale('en');
  expect(t('goal.row', { name: 'My goal {name}', todos: 1, routines: 2 })).toBe(
    '[My goal {name}, ţóďóš: 1, ŕóúţíñéš: 2~~~~~~]',
  );
  expect(t('goal.total', { count: 1 })).toBe('[1 ğóáľ~~]');
  setPseudoLocale(false);
  expect(t('goal.total', { count: 1 })).toBe('1 goal');
});
