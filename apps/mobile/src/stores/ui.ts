import { todayISO, type ISODate } from '@nodii/core';
import { create } from 'zustand';

const today = todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', new Date());
interface UIState {
  today: ISODate;
  selectedDate: ISODate;
  lastAddedGoalId: string | null;
  selectDate(date: ISODate): void;
  updateToday(date: ISODate): void;
  rememberAddedGoal(goalId: string): void;
  reset(): void;
}
/** MOB-02/03: 날짜와 마지막 추가 목표만 보관하고 서버 행은 Query에 둔다. */
export const useUIStore = create<UIState>((set) => ({
  today,
  selectedDate: today,
  lastAddedGoalId: null,
  selectDate: (selectedDate) => set({ selectedDate }),
  updateToday: (next) =>
    set((state) => ({
      today: next,
      selectedDate: state.selectedDate === state.today ? next : state.selectedDate,
    })),
  rememberAddedGoal: (lastAddedGoalId) => set({ lastAddedGoalId }),
  reset: () => {
    const next = todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', new Date());
    set({ today: next, selectedDate: next, lastAddedGoalId: null });
  },
}));
