import { ko, type MessageKey } from './catalog.ko';

export type MessageParams = Readonly<Record<string, string | number>>;

/** SET-06: 화면 코드가 문구 조합을 맡지 않도록 카탈로그의 자리표시자를 한곳에서 치환한다. */
export function t(key: MessageKey, params: MessageParams = {}): string {
  return ko[key].replace(/\{([^}]+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}
