import { toast } from 'sonner';
import { OfflineWriteError } from '@nodii/api';

/** NFR-12: 서버의 내부 오류를 노출하지 않고 실패와 재시도 경로를 알린다. */
export function notifyError(_error: unknown, retry?: () => void | Promise<void>): void {
  if (_error instanceof OfflineWriteError) {
    toast.error('오프라인이라 저장할 수 없어요');
    return;
  }
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
