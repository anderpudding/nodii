import { setPseudoLocale } from '@nodii/i18n';

/** SET-06: Expo 프로덕션 번들의 __DEV__가 false이면 공개 플래그와 무관하게 끈다. */
export function configurePseudoLocale(development: boolean, flag: string | undefined) {
  setPseudoLocale(development && flag === '1');
}
