export type Locale = 'ko' | 'en';
export type LanguagePreference = 'system' | Locale;

/** SET-06: 시스템 언어는 첫 선호만 따르고 지원하지 않는 언어는 영어로 보여준다. */
export function resolveLocale(
  preference: LanguagePreference,
  systemLanguages: readonly string[],
): Locale {
  if (preference !== 'system') return preference;
  return systemLanguages[0]?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

let locale: Locale = 'ko';
const listeners = new Set<() => void>();

/** 모바일이 초기화하기 전까지 기존 한국어를 유지한다. */
export function getLocale(): Locale {
  return locale;
}

/** 같은 언어의 재적용은 구독 화면을 불필요하게 다시 그리지 않는다. */
export function setLocale(value: Locale): void {
  if (locale === value) return;
  locale = value;
  listeners.forEach((listener) => listener());
}

/** React 없이 두 앱에서 같은 로케일 변경을 구독한다. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 지원 언어의 표시 형식을 플랫폼과 무관하게 고정한다. */
export function intlLocale(value: Locale): 'ko-KR' | 'en-US' {
  return value === 'ko' ? 'ko-KR' : 'en-US';
}
