export const undoLifetime = 2500;
export interface ToastEntry {
  id: number;
  text: string | (() => string);
  expiresAt: number;
  undo?: () => Promise<void>;
  busy?: boolean;
}
/**
 * TODO-04: 토스트는 한 번에 하나만 보인다. 새 안내가 오면 앞 안내와 그 실행 취소는 사라지고,
 * 이미 복원 중인 작업만 성공/실패 처리를 위해 보이지 않게 남겨 둔다.
 */
export function enqueueToast(entries: readonly ToastEntry[], entry: ToastEntry, _now: number) {
  return [...entries.filter((item) => item.busy), entry];
}
/** 만료한 작업만 제거한다. 복원 중인 작업은 끝날 때까지 남긴다. */
export function expireToasts(entries: readonly ToastEntry[], now: number) {
  return entries.filter((item) => item.expiresAt > now || item.busy);
}
/** 화면에는 가장 최근 안내 하나만 그린다. */
export function visibleToast(entries: readonly ToastEntry[]) {
  return entries.at(-1);
}
