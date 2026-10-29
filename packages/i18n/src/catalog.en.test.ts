import { afterEach, expect, it } from 'vitest';
import { en } from './catalog.en';
import { ko, type MessageKey } from './catalog.ko';
import { setLocale } from './locale';
import { t } from './translate';

afterEach(() => setLocale('ko'));

function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!))].sort();
}

it('영어 기본 키와 순서가 한국어와 같고 복수형은 count 문구에만 붙는다', () => {
  const keys = new Set(Object.keys(ko));
  const base: string[] = [];
  const entries = Object.entries(en);
  for (const [index, [key]] of entries.entries()) {
    if (keys.has(key)) {
      base.push(key);
      continue;
    }
    const match = /^(.*)_one$/.exec(key);
    expect(match, key).not.toBeNull();
    const parent = match![1] as MessageKey;
    expect(keys.has(parent), key).toBe(true);
    expect(ko[parent], key).toContain('{count}');
    expect(entries[index + 1]?.[0], key).toBe(parent);
  }
  expect(base).toEqual(Object.keys(ko));
});

it('두 언어의 자리표시자가 같고 영어에는 한국어 조사가 없다', () => {
  for (const [key, message] of Object.entries(en)) {
    const parent = key.replace(/_one$/, '') as MessageKey;
    expect(placeholders(message), key).toEqual(
      placeholders(ko[parent]).filter((name) => name !== 'particle'),
    );
    expect(message, key).not.toContain('{particle}');
    expect(message.trim(), key).not.toBe('');
  }
});

it('언어 이름 외에는 한글이 없고 로그인 설명은 이메일을 정확히 한 번 포함한다', () => {
  for (const [key, message] of Object.entries(en)) {
    if (key !== 'settings.language.ko') expect(message, key).not.toMatch(/[ㄱ-ㅎㅏ-ㅣ가-힣]/);
  }
  expect(en['auth.code.description'].match(/\{email\}/g)).toHaveLength(1);
});

it('복수형과 여러 개수의 문장을 실제 카탈로그로 치환한다', () => {
  setLocale('en');
  expect([1, 2].map((count) => t('goal.total', { count }))).toMatchInlineSnapshot(`
    [
      "1 goal",
      "2 goals",
    ]
  `);
  expect(t('goal.row', { name: 'Study', todos: 1, routines: 2 })).toBe(
    'Study, todos: 1, routines: 2',
  );
  expect(t('settings.delete.counts', { goals: 1, todos: 2, routines: 0 })).toBe(
    'The following will be deleted: goals (1), todos (2), and routines (0).',
  );
  expect(t('todo.deleted', { title: 'Read', particle: '를' })).toBe("Deleted 'Read'");
  expect(t('calendar.remainingTodos', { date: 'Oct 29', count: 1 })).toBe(
    'Oct 29, 1 unfinished todo',
  );
  expect(t('calendar.remainingTodos', { date: 'Oct 29', count: 2 })).toBe(
    'Oct 29, 2 unfinished todos',
  );
});
