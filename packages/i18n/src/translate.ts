import { ko, type MessageKey } from './catalog.ko';
import { en } from './catalog.en';
import { getLocale, intlLocale, type Locale } from './locale';

export type MessageParams = Readonly<Record<string, string | number>>;
export type PluralKey = `${MessageKey}_${Intl.LDMLPluralRule}`;
type Catalog = Partial<Record<MessageKey | PluralKey, string>>;

/** SET-06: 화면 코드가 문구 조합을 맡지 않도록 카탈로그의 자리표시자를 한곳에서 치환한다. */
export function createTranslator(catalogs: { ko: Record<MessageKey, string>; en: Catalog }) {
  return (key: MessageKey, params: MessageParams = {}): string => {
    const locale: Locale = getLocale();
    const catalog: Catalog = catalogs[locale];
    let message = catalog[key];
    if (
      locale !== 'ko' &&
      typeof params.count === 'number' &&
      catalogs.ko[key].includes('{count}')
    ) {
      const rule = new Intl.PluralRules(intlLocale(locale)).select(params.count);
      message = catalog[`${key}_${rule}`] ?? message;
    }
    return (message ?? catalogs.ko[key]).replace(/\{([^}]+)\}/g, (placeholder, name: string) => {
      const value = params[name];
      return value === undefined ? placeholder : String(value);
    });
  };
}

export const t = createTranslator({ ko, en });
