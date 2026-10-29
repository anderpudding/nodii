import { t } from '@nodii/i18n';
import { useEffect, type ReactNode } from 'react';
import { addDays } from '@nodii/core';
import { Button } from '../../components/ui/button';
import { useUIStore } from '../../stores/ui';

/** 입력·메뉴 조작을 방해하지 않고 달 경계를 포함해 하루씩 이동한다. */
export function DayHeader({
  total = 0,
  done = 0,
  menu,
}: {
  total?: number;
  done?: number;
  menu?: ReactNode;
}) {
  const { selectedDate, today, selectDate } = useUIStore();
  useEffect(() => {
    const move = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [data-drag-handle], [contenteditable]:not([contenteditable="false"]), [role="menu"], [role="dialog"], [role="alertdialog"], [role="grid"]',
        )
      )
        return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      selectDate(addDays(useUIStore.getState().selectedDate, event.key === 'ArrowLeft' ? -1 : 1));
    };
    window.addEventListener('keydown', move);
    return () => window.removeEventListener('keydown', move);
  }, [selectDate]);
  const label = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${selectedDate}T00:00:00Z`));
  return (
    <header className="day-header">
      <div>
        <h1>{selectedDate === today ? t('day.heading.today', { date: label }) : label}</h1>
        <p className="supporting">
          {total
            ? t(selectedDate === today ? 'day.summary.today' : 'day.summary', { total, done })
            : t('day.empty')}
        </p>
      </div>
      <div className="day-navigation">
        <Button
          variant="ghost"
          aria-label={t('day.previous')}
          onClick={() => selectDate(addDays(selectedDate, -1))}
        >
          ‹
        </Button>
        <Button
          variant="ghost"
          aria-label={t('day.next')}
          onClick={() => selectDate(addDays(selectedDate, 1))}
        >
          ›
        </Button>
        {menu}
      </div>
    </header>
  );
}
