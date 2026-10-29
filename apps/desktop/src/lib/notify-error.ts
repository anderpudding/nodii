import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { OfflineWriteError } from '@nodii/api';

/** NFR-12: 서버의 내부 오류를 노출하지 않고 실패와 재시도 경로를 알린다. */
export function notifyError(_error: unknown, retry?: () => void | Promise<void>): void {
  if (_error instanceof OfflineWriteError) {
    toast.error(t('sync.writeDisabled'));
    return;
  }
  toast.error(t('common.saveFailed'), {
    duration: 5000,
    action: retry
      ? {
          label: t('common.tryAgain'),
          onClick: () => {
            void Promise.resolve()
              .then(retry)
              .catch((error: unknown) => notifyError(error, retry));
          },
        }
      : undefined,
  });
}
