import { useSyncExternalStore } from 'react';
import { getLocale, subscribeLocale } from '@nodii/i18n';

/** SET-06: 라우트 상태를 보존한 채 표시 언어만 다시 그린다. */
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
