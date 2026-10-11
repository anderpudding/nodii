import { expect, it } from 'vitest';
import { enqueueToast, expireToasts } from './undo-queue';

it('연속 삭제의 세 복원 작업과 각각의 만료 시점을 보존한다', async () => {
  const restored: number[] = [];
  let queue = [] as ReturnType<typeof enqueueToast>;
  for (let id = 1; id <= 3; id++)
    queue = enqueueToast(
      queue,
      {
        id,
        text: `${id}`,
        expiresAt: id * 1000 + 5000,
        undo: async () => {
          restored.push(id);
        },
      },
      id * 1000,
    );
  expect(queue).toHaveLength(3);
  for (const entry of queue) await entry.undo?.();
  expect(restored).toEqual([1, 2, 3]);
  expect(expireToasts(queue, 6000).map((entry) => entry.id)).toEqual([2, 3]);
});
it('복원 중인 항목은 만료되어도 성공/실패 처리까지 보존한다', () => {
  expect(expireToasts([{ id: 1, text: '삭제', expiresAt: 5, busy: true }], 6)).toHaveLength(1);
});
