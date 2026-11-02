import { expect, it } from 'vitest';
import { enqueueToast, expireToasts, undoLifetime, visibleToast } from './undo-queue';

it('새 안내가 오면 앞 안내를 바꿔 하나만 남긴다', () => {
  let queue = [] as ReturnType<typeof enqueueToast>;
  for (let id = 1; id <= 3; id++)
    queue = enqueueToast(queue, { id, text: `${id}`, expiresAt: id + undoLifetime }, id);
  expect(queue.map((entry) => entry.id)).toEqual([3]);
  expect(visibleToast(queue)?.id).toBe(3);
});
it('복원 중인 작업은 새 안내가 와도 처리 결과가 나올 때까지 남기되 새 안내만 보인다', () => {
  const queue = enqueueToast(
    [{ id: 1, text: '삭제', expiresAt: 10, busy: true }],
    { id: 2, text: '완료', expiresAt: 20 },
    5,
  );
  expect(queue.map((entry) => entry.id)).toEqual([1, 2]);
  expect(visibleToast(queue)?.id).toBe(2);
});
it('실행 취소는 2.5초 동안 유지되고 복원 중인 항목은 만료되어도 보존한다', () => {
  expect(undoLifetime).toBe(2500);
  expect(expireToasts([{ id: 1, text: '삭제', expiresAt: 2500 }], 2500)).toHaveLength(0);
  expect(expireToasts([{ id: 1, text: '삭제', expiresAt: 5, busy: true }], 6)).toHaveLength(1);
});
