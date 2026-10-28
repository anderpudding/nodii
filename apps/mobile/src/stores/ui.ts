import { todayISO, monthKeyOf, type ISODate } from '@nodii/core';
import { create } from 'zustand';

const today = todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', new Date());
interface UIState {
  today: ISODate;
  selectedDate: ISODate;
  monthExpanded: boolean;
  calendarMonth: string;
  setMonthExpanded(expanded: boolean): void;
  showMonth(month: string): void;
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
  monthExpanded: false,
  calendarMonth: monthKeyOf(today),
  setMonthExpanded: (expanded) =>
    set((state) => ({
      monthExpanded: expanded,
      calendarMonth: monthKeyOf(state.selectedDate),
    })),
  showMonth: (calendarMonth) => set({ calendarMonth }),
  selectDate: (selectedDate) => set({ selectedDate, calendarMonth: monthKeyOf(selectedDate) }),
  updateToday: (next) =>
    set((state) => ({
      today: next,
      selectedDate: state.selectedDate === state.today ? next : state.selectedDate,
    })),
  rememberAddedGoal: (lastAddedGoalId) => set({ lastAddedGoalId }),
  reset: () => {
    const next = todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', new Date());
    set({
      today: next,
      selectedDate: next,
      lastAddedGoalId: null,
      monthExpanded: false,
      calendarMonth: monthKeyOf(next),
    });
  },
}));
