import { expect, it } from 'vitest';
import { routineToastMessage } from './messages';

it.each([
  { title: '장보기', particle: '를' },
  { title: '운동', particle: '을' },
  { title: '러닝 5km', particle: '를' },
])(
  '루틴 완료 토스트는 $title에 $particle 조사를 붙여 할 일과 같은 문장이 된다',
  ({ title, particle }) => {
    expect(routineToastMessage('todo.toggled', title)).toBe(`'${title}'${particle} 완료했어요`);
  },
);
it.each([
  { title: '장보기', particle: '를' },
  { title: '운동', particle: '을' },
  { title: '러닝 5km', particle: '를' },
])('루틴 건너뛰기는 $title에 $particle 조사를 붙인다', ({ title, particle }) => {
  expect(routineToastMessage('routine.skipped', title)).toBe(
    `'${title}'${particle} 오늘은 건너뛰었어요`,
  );
});
it.each([
  { title: '장보기', particle: '를' },
  { title: '운동', particle: '을' },
  { title: '러닝 5km', particle: '를' },
])('건너뛰기 취소도 $title에 $particle 조사를 붙여 자연스럽게 안내한다', ({ title, particle }) => {
  expect(routineToastMessage('routine.unskipped', title)).toBe(
    `'${title}'${particle} 다시 하기로 했어요`,
  );
});
it('완료 취소도 할 일 카탈로그의 같은 문구를 유지한다', () => {
  expect(routineToastMessage('todo.untoggled', '운동')).toBe("'운동' 완료를 취소했어요");
});
