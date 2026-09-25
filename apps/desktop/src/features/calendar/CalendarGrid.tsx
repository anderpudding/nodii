import { useId, useRef, useState } from 'react';
import { addDays, monthGridRange, monthKeyOf, weekdayOf, type DaySummary } from '@nodii/core';
import { adjacentMonthKey } from '@nodii/api';
import { Button } from '../../components/ui/button';

/** 표시만 UTC로 고정해 저장 날짜가 시간대로 밀리지 않게 한다. */
export function formatCalendarDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' },
) {
  return new Intl.DateTimeFormat('ko-KR', { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
interface CalendarProps {
  month: string;
  week?: { start: string; onChange: (date: string) => void };
  selectedDate: string;
  today: string;
  weekStart: 0 | 1;
  summary?: Map<string, DaySummary>;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
}
/** 42칸과 방향키 탐색을 월간 보기와 날짜 선택에서 재사용한다 (CAL-01~05). */
export function CalendarGrid({
  month,
  week,
  selectedDate,
  today,
  weekStart,
  summary,
  onMonthChange,
  onSelect,
}: CalendarProps) {
  const headingId = useId();
  const grid = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(selectedDate);
  const days = week
    ? Array.from({ length: 7 }, (_, i) => addDays(week.start, i))
    : monthGridRange(month, weekStart).days;
  const tabDate = days.includes(focused)
    ? focused
    : days.includes(selectedDate)
      ? selectedDate
      : days[0]!;
  const weekdays = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  return (
    <div className="month-calendar">
      <div className="calendar-header">
        <h2 id={headingId}>
          {formatCalendarDate(`${month}-01`, { year: 'numeric', month: 'long' })}
        </h2>
        <div className="calendar-navigation">
          <Button
            variant="ghost"
            aria-label={week ? '이전 주' : '이전 달'}
            onClick={() =>
              week
                ? week.onChange(addDays(week.start, -7))
                : onMonthChange(adjacentMonthKey(month, -1))
            }
          >
            ‹
          </Button>
          <Button
            variant="ghost"
            aria-label={week ? '다음 주' : '다음 달'}
            onClick={() =>
              week
                ? week.onChange(addDays(week.start, 7))
                : onMonthChange(adjacentMonthKey(month, 1))
            }
          >
            ›
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (week) week.onChange(today);
              else onMonthChange(monthKeyOf(today));
              onSelect(today);
            }}
          >
            오늘
          </Button>
        </div>
      </div>
      <div ref={grid} role="grid" aria-labelledby={headingId} className="calendar-grid">
        <div role="row" className="calendar-week">
          {weekdays.map((day) => (
            <div role="columnheader" className={`calendar-weekday weekday-${day}`} key={day}>
              {['일', '월', '화', '수', '목', '금', '토'][day]}
            </div>
          ))}
        </div>
        {Array.from({ length: days.length / 7 }, (_, weekIndex) => (
          <div role="row" className="calendar-week" key={weekIndex}>
            {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, column) => {
              const counts = summary?.get(date);
              const completed = !!counts?.total && counts.remaining === 0;
              const label = `${formatCalendarDate(date, { year: 'numeric', month: 'long', day: 'numeric' })}${counts?.total ? (completed ? ', 모두 끝냄' : `, 남은 할 일 ${counts.remaining}개`) : ''}`;
              return (
                <div role="gridcell" aria-selected={date === selectedDate} key={date}>
                  <button
                    type="button"
                    data-date={date}
                    className={`calendar-cell weekday-${weekdayOf(date)}${monthKeyOf(date) !== month ? ' calendar-outside' : ''}`}
                    aria-label={label}
                    aria-current={date === today ? 'date' : undefined}
                    tabIndex={date === tabDate ? 0 : -1}
                    onFocus={() => setFocused(date)}
                    onClick={() => {
                      if (!week && monthKeyOf(date) !== month) onMonthChange(monthKeyOf(date));
                      onSelect(date);
                    }}
                    onKeyDown={(event) => {
                      const offset = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                        Home: -column,
                        End: 6 - column,
                      }[event.key];
                      if (offset === undefined) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const next = addDays(date, offset);
                      setFocused(next);
                      if (!days.includes(next)) {
                        if (week) week.onChange(next);
                        else onMonthChange(monthKeyOf(next));
                      }
                      requestAnimationFrame(() =>
                        grid.current
                          ?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)
                          ?.focus(),
                      );
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={`calendar-stamp${completed ? ' stamp-complete' : counts?.remaining ? (date > today ? ' stamp-future' : ' stamp-remaining') : ' stamp-empty'}`}
                    >
                      {completed ? (
                        <svg viewBox="0 0 22 22">
                          <path d="m5 11 4 4 8-8" />
                        </svg>
                      ) : (
                        counts?.remaining || ''
                      )}
                    </span>
                    <span
                      className={`calendar-number${date === selectedDate ? ' date-selected' : date === today ? ' date-today' : ''}`}
                      aria-hidden="true"
                    >
                      {Number(date.slice(8))}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
