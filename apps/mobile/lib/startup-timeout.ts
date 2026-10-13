export const STARTUP_TIMEOUT_MS = 10_000;

/** M6: 응답 없는 초기 복원이 스플래시/준비 화면을 영원히 붙잡지 않게 한다. */
export async function withStartupTimeout<T>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('startup_timeout')), STARTUP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
