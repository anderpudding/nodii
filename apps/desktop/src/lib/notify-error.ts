import { toast } from 'sonner';

/** NFR-12: 서버의 내부 오류를 노출하지 않고 실패와 재시도 경로를 알린다. */
export function notifyError(_error: unknown, retry?: () => void | Promise<void>): void {
  toast.error('저장하지 못했어요', {
    duration: 5000,
    action: retry
      ? {
          label: '다시 시도',
          onClick: () => {
            void Promise.resolve()
              .then(retry)
              .catch((error: unknown) => notifyError(error, retry));
          },
        }
      : undefined,
  });
}
