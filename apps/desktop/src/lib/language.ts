import {
  getLocale,
  resolveLocale,
  setLocale,
  subscribeLocale,
  t,
  type LanguagePreference,
  type Locale,
} from '@nodii/i18n';
import { useSyncExternalStore } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { toast } from 'sonner';
import { installAppMenu } from './commands';

const key = 'nodii-language';
const valid = (value: unknown): value is LanguagePreference =>
  value === 'system' || value === 'ko' || value === 'en';
function readLanguage(): LanguagePreference {
  try {
    const value = localStorage.getItem(key);
    return valid(value) ? value : 'system';
  } catch {
    return 'system';
  }
}
let language = readLanguage();
let revision = 0;
const listeners = new Set<() => void>();
let menuLocale: Locale | undefined;
let menuQueue = Promise.resolve();

function updateMenu(locale: Locale) {
  // StrictMode의 effect 재시작과 store 원본의 같은 값 재적용은 설치를 반복하지 않는다.
  if (menuLocale === locale) return;
  menuLocale = locale;
  // 빠른 언어 전환에서도 이전 비동기 설치가 새 메뉴를 덮어쓰지 않게 직렬화한다.
  menuQueue = menuQueue.then(installAppMenu).catch(() => {
    if (menuLocale === locale) menuLocale = undefined;
    toast.error(t('app.menu.failed'));
  });
}
function apply(value: LanguagePreference) {
  language = value;
  const locale = resolveLocale(value, navigator.languages ?? [navigator.language]);
  setLocale(locale);
  document.documentElement.lang = locale;
  updateMenu(locale);
  listeners.forEach((listener) => listener());
}
function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** SET-06: 기기 설정만 구독하고 서버 프로필에 언어를 복사하지 않는다. */
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, () => language);
}

/** React 의존성은 데스크톱에만 두고 App에서 문구 트리 전체를 다시 그린다. */
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale);
}

/** 미러를 먼저 적용하고, 사용자가 변경하지 않았을 때만 store 원본으로 덮는다. */
export function startLanguage() {
  let active = true;
  const currentRevision = revision;
  apply(readLanguage());
  const update = () => {
    if (language === 'system') apply(language);
  };
  window.addEventListener('languagechange', update);
  if (isTauri())
    void load('settings.json', { autoSave: false })
      .then(async (store) => {
        const stored = await store.get<LanguagePreference>('language');
        if (active && currentRevision === revision) {
          apply(valid(stored) ? stored : 'system');
          localStorage.setItem(key, language);
        }
      })
      .catch(() => {
        if (active) toast.error(t('settings.language.loadFailed'));
      });
  return () => {
    active = false;
    window.removeEventListener('languagechange', update);
  };
}

/** 저장 실패 시 화면도 되돌려 표시 언어와 기기 설정을 일치시킨다. */
export async function setLanguage(value: LanguagePreference) {
  const previous = language;
  const currentRevision = ++revision;
  apply(value);
  try {
    if (isTauri()) {
      const store = await load('settings.json', { autoSave: false });
      await store.set('language', value);
      await store.save();
    }
    localStorage.setItem(key, value);
  } catch (error) {
    if (revision === currentRevision) apply(previous);
    throw error;
  }
}
