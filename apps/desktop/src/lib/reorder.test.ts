import { expect, it } from 'vitest';
import { reorderedKey } from './reorder';
const items = [
  { id: 'todo-a', sortKey: 'a0' },
  { id: 'routine', sortKey: 'a1' },
  { id: 'todo-b', sortKey: 'a2' },
  { id: 'todo-c', sortKey: 'a3' },
];
it('할 일을 루틴 뒤로 이동하면 루틴과 다음 할 일의 사이 키를 만든다', () => {
  const key = reorderedKey(items, 'todo-a', 'routine')!;
  expect(key > 'a1' && key < 'a2').toBe(true);
  expect(items[0]!.sortKey).toBe('a0');
});
it('위로 이동 및 맨 앞/뒤 이동도 이동한 행의 새 키만 만든다', () => {
  expect(reorderedKey(items, 'todo-c', 'routine')! > 'a0').toBe(true);
  expect(reorderedKey(items, 'todo-c', 'routine')! < 'a1').toBe(true);
  expect(reorderedKey(items, 'todo-c', 'todo-a')! < 'a0').toBe(true);
  expect(reorderedKey(items, 'todo-a', 'todo-c')! > 'a3').toBe(true);
});
it('다른 목표의 행 또는 이동 없는 드롭은 저장하지 않는다', () => {
  expect(reorderedKey(items, 'todo-a', 'foreign')).toBeNull();
  expect(reorderedKey(items, 'todo-a', 'todo-a')).toBeNull();
});
