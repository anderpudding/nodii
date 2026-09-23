import { useSyncExternalStore } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { toast } from 'sonner';

export type Theme = 'system' | 'light' | 'dark';
const key = 'nodii-theme';
const valid = (value: unknown): value is Theme =>
  value === 'system' || value === 'light' || value === 'dark';
function readTheme(): Theme {
  try {
    const value = localStorage.getItem(key);
    return valid(value) ? value : 'system';
  } catch {
    return 'system';
  }
}
let theme = readTheme();
let revision = 0;
const listeners = new Set<() => void>();
function apply(value: Theme) {
  theme = value;
  document.documentElement.classList.toggle(
    'dark',
    value === 'dark' ||
      (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
  );
  listeners.forEach((listener) => listener());
}
/** SET-02: 기기 테마만 구독하고 서버 데이터와 섞지 않는다. */
export function useTheme() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => theme,
  );
}
/** index.html의 동기 미러 뒤에 plugin-store 원본과 시스템 변경을 연결한다. */
export function startTheme() {
  let active = true;
  const currentRevision = revision;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => apply(theme);
  apply(theme);
  media.addEventListener('change', update);
  if (isTauri())
    void load('settings.json', { autoSave: false })
      .then(async (store) => {
        const stored = await store.get<Theme>('theme');
        if (active && currentRevision === revision) {
          apply(valid(stored) ? stored : 'system');
          localStorage.setItem(key, theme);
        }
      })
      .catch(() => toast.error('테마 설정을 불러오지 못했어요'));
  return () => {
    active = false;
    media.removeEventListener('change', update);
  };
}
/** 저장 실패 시 화면도 원래 테마로 되돌려 기기 설정과 일치시킨다. */
export async function setTheme(value: Theme) {
  const previous = theme;
  const currentRevision = ++revision;
  apply(value);
  try {
    if (isTauri()) {
      const store = await load('settings.json', { autoSave: false });
      await store.set('theme', value);
      await store.save();
    }
    localStorage.setItem(key, value);
  } catch (error) {
    if (revision === currentRevision) apply(previous);
    throw error;
  }
}
