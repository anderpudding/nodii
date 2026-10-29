import { setPseudoLocale } from '@nodii/i18n';

/** SET-06: 빌드 도구가 DEV를 false로 치환하므로 배포 빌드는 플래그가 있어도 항상 꺼진다. */
export function configurePseudoLocale(): void {
  setPseudoLocale(import.meta.env.DEV && import.meta.env.VITE_PSEUDO_LOCALE === '1');
}
