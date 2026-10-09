import { expect, it } from 'vitest';
import { lockTransformToVerticalAxis } from './sortable-list';

it('행 드래그의 수평 이동은 제거하고 세로 이동과 크기는 유지한다', () => {
  expect(lockTransformToVerticalAxis({ x: 96, y: -44, scaleX: 0.98, scaleY: 1.02 })).toEqual({
    x: 0,
    y: -44,
    scaleX: 0.98,
    scaleY: 1.02,
  });
});
