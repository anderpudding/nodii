import { describe, expect, it } from 'vitest';
import { droppedRowIndex } from '../../components/gestures/swipe';
import { reorderedTodoKey } from './reorder';

const items = [
  { id: 'a', sortKey: 'a0' },
  { id: 'r', sortKey: 'a1' },
  { id: 'b', sortKey: 'a2' },
];

describe('reorderedTodoKey', () => {
  it('아래로 옮기면 새 이웃 사이 키를 만든다', () => {
    const key = reorderedTodoKey(items, 'a', 1)!;
    expect(key > 'a1' && key < 'a2').toBe(true);
  });
  it('맨 위로 옮기면 첫 행보다 작은 키를 만든다', () => {
    expect(reorderedTodoKey(items, 'b', 0)! < 'a0').toBe(true);
  });
  it('맨 아래 너머는 마지막 위치로 자른다', () => {
    expect(reorderedTodoKey(items, 'a', 9)! > 'a2').toBe(true);
  });
  it('제자리이거나 없는 행이면 갱신하지 않는다', () => {
    expect(reorderedTodoKey(items, 'r', 1)).toBeNull();
    expect(reorderedTodoKey(items, 'x', 0)).toBeNull();
  });
});

describe('droppedRowIndex', () => {
  it('행 중심을 넘은 만큼만 위치를 바꾼다', () => {
    expect(droppedRowIndex([52, 52, 52], 0, 30)).toBe(0);
    expect(droppedRowIndex([52, 52, 52], 0, 60)).toBe(1);
    expect(droppedRowIndex([52, 52, 52], 2, -110)).toBe(0);
  });
});
