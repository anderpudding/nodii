import { todayISO, type ISODate } from '@nodii/core';
import { create } from 'zustand';

const today = todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date());
interface UIState {
  selectedDate: ISODate;
  today: ISODate;
  selectDate: (date: ISODate) => void;
}
/** 서버 데이터는 넣지 않고 날짜 선택 같은 UI 상태만 보관한다. */
export const useUIStore = create<UIState>((set) => ({
  today,
  selectedDate: today,
  selectDate: (selectedDate) => set({ selectedDate }),
}));
