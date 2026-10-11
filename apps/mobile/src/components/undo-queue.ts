export const undoLifetime = 5000;
export interface ToastEntry {
  id: number;
  text: string;
  expiresAt: number;
  undo?: () => Promise<void>;
  busy?: boolean;
}
/** TODO-04: 새 안내가 앞 안내를 덮어도 아직 유효한 실행 취소를 모두 보존한다. */
export function enqueueToast(entries: readonly ToastEntry[], entry: ToastEntry, now: number) {
  return [...entries.filter((item) => item.expiresAt > now || item.busy), entry];
}
/** 만료한 작업만 제거해 각 삭제가 자기 5초를 갖는다. */
export function expireToasts(entries: readonly ToastEntry[], now: number) {
  return entries.filter((item) => item.expiresAt > now || item.busy);
}
