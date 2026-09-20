import { todayISO, type ISODate } from '@nodii/core';
import { create } from 'zustand';

const today = todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date());
interface UIState {
  lastAddedGoalByDate: Record<ISODate, string>;
  rememberAddedGoal: (date: ISODate, goalId: string) => void;
  selectedDate: ISODate;
  today: ISODate;
  selectDate: (date: ISODate) => void;
  updateToday: (date: ISODate) => void;
}
/** 서버 데이터는 넣지 않고 날짜 선택 같은 UI 상태만 보관한다. */
export const useUIStore = create<UIState>((set) => ({
  lastAddedGoalByDate: {},
  rememberAddedGoal: (date, goalId) =>
    set((state) => ({ lastAddedGoalByDate: { ...state.lastAddedGoalByDate, [date]: goalId } })),
  today,
  selectedDate: today,
  selectDate: (selectedDate) => set({ selectedDate }),
  updateToday: (next) =>
    set((state) =>
      state.today === next
        ? state
        : {
            today: next,
            selectedDate: state.selectedDate === state.today ? next : state.selectedDate,
          },
    ),
}));
