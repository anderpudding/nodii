import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ReportSheet } from './ReportSheet';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFriendDay, type NodiiClient } from '@nodii/api';
import {
  addDays,
  buildDay,
  monthGridRange,
  monthKeyOf,
  summarizeMonth,
  weekdayOf,
  type DayGoalGroup,
  type Profile,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { Button } from '../../components/ui/button';
import { SproutCheck } from '../../components/ui/sprout-check';
import { CalendarGrid } from '../calendar/CalendarGrid';
import { completedStampColors } from '../calendar/stamp-colors';
import { DaySkeleton } from '../day-list/DayView';
import { GoalChip, goalStyle } from '../goals/GoalChip';
import { onSocialForeground } from './InviteReceiver';

/** SOC-32: 친구 항목은 쓰기 훅이 없는 목록으로 그린다. */
function FriendList({
  groups,
  onReport,
}: {
  groups: DayGoalGroup[];
  onReport?: (todo: { id: string; title: string }) => void;
}) {
  return (
    <div className="day-list">
      {groups.map(({ goal, items }) => (
        <section key={goal.id} className="goal-group" style={goalStyle(goal.color)}>
          <GoalChip goal={goal} friend />
          <ul>
            {items.map((item) => {
              const todo = item.kind === 'todo' ? item.todo : null;
              const title = item.kind === 'todo' ? item.todo.title : item.routine.title;
              const done = item.kind === 'todo' ? item.todo.isDone : item.log?.status === 'done';
              const key = todo
                ? `todo:${todo.id}`
                : `routine:${item.kind === 'routine' && item.routine.id}`;
              const report = todo && onReport ? () => onReport(todo) : undefined;
              const row = (
                <li
                  key={key}
                  className="friend-day-row"
                  aria-label={t(done ? 'social.today.finished' : 'social.today.unfinished', {
                    title,
                  })}
                >
                  <SproutCheck done={done} />
                  <span className={done ? 'supporting' : undefined}>{title}</span>
                  {report && (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          className="friend-report-more"
                          aria-label={t('mobile.menu.open', { title })}
                        >
                          ⋯
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="todo-menu" align="end">
                          <DropdownMenu.Item className="todo-menu-item" onSelect={report}>
                            {t('social.report.action')}
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  )}
                </li>
              );
              return report ? (
                <ContextMenu.Root key={key}>
                  <ContextMenu.Trigger asChild>{row}</ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Content className="todo-menu">
                      <ContextMenu.Item className="todo-menu-item" onSelect={report}>
                        {t('social.report.action')}
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              ) : (
                row
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** SOC-33·38: 오늘 탭과 사람 하루 페이지가 같은 읽기 전용 본문을 쓴다. */
export function FriendDay({
  client,
  friendId,
  profile,
  today,
  date,
  onSelect,
  me,
  nickname,
  onBlocked,
  extra,
  manage,
}: {
  client: NodiiClient;
  friendId: string;
  profile: Pick<Profile, 'timezone' | 'weekStart'>;
  today: string;
  date: string;
  onSelect(date: string): void;
  me?: string;
  nickname?: string;
  onBlocked?(): void;
  extra?: ReactNode;
  manage?: ReactNode;
}) {
  const [report, setReport] = useState<{ id: string; title: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ date, month: monthKeyOf(date) });
  const month = view.date === date ? view.month : monthKeyOf(date);
  const range = monthGridRange(month, profile.weekStart);
  const query = useFriendDay(client, friendId, range);
  // 달만 둘러볼 때 오른쪽은 계속 고른 날짜를 표시한다.
  const selectedRange = monthGridRange(monthKeyOf(date), profile.weekStart);
  const separate = date < range.from || date > range.to;
  const selected = useFriendDay(client, separate ? friendId : null, selectedRange);
  const { refetch } = query;
  const { refetch: refetchSelected } = selected;
  useEffect(() => {
    const reload = () => {
      void refetch();
      if (separate) void refetchSelected();
    };
    const stop = onSocialForeground(reload);
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        root.current?.closest('[hidden]') ||
        !(event.target instanceof HTMLElement) ||
        event.target.closest(
          'input,textarea,select,[role=grid],[role=dialog],[role=menu],[data-drag-handle]',
        ) ||
        document.querySelector(
          '[role=dialog],[role=alertdialog],[role=menu],.social-today[hidden] .friend-day:focus-within',
        )
      )
        return;
      if (event.metaKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        reload();
      } else if (
        !event.metaKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        onSelect(addDays(date, event.key === 'ArrowLeft' ? -1 : 1));
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      stop();
      window.removeEventListener('keydown', keydown);
    };
  }, [date, onSelect, refetch, refetchSelected, separate]);
  const { summary, stampColors } = useMemo(() => {
    if (!query.data || query.isError) return {};
    const input = {
      ...query.data,
      ...monthGridRange(month, profile.weekStart),
      timeZone: profile.timezone,
    };
    const summary = summarizeMonth(input);
    return { summary, stampColors: completedStampColors(input, summary) };
  }, [month, profile.timezone, profile.weekStart, query.data, query.isError]);
  const day = separate ? selected : query;
  const groups = useMemo(
    () => (day.data ? buildDay({ ...day.data, date, timeZone: profile.timezone }) : []),
    [day.data, date, profile.timezone],
  );
  const calendar = (week = false) => (
    <CalendarGrid
      month={week ? monthKeyOf(date) : month}
      monthTitleAction
      selectedDate={date}
      today={today}
      weekStart={profile.weekStart}
      summary={summary}
      stampColors={stampColors}
      week={
        week
          ? {
              start: addDays(date, -((weekdayOf(date) - profile.weekStart + 7) % 7)),
              onChange: onSelect,
            }
          : undefined
      }
      onMonthChange={(next) => setView({ date, month: next })}
      onSelect={(next) => {
        if (next !== date) onSelect(next);
        else if (next === today) setView({ date, month: monthKeyOf(today) });
      }}
    />
  );
  return (
    <div ref={root} className="app-shell friend-day">
      <aside className="sidebar">
        <section className="sidebar-calendar">{calendar()}</section>
      </aside>
      <div className="day-panel">
        <section className="week-strip">{calendar(true)}</section>
        {manage ?? (
          <main className="day-content">
            {extra}
            <div className="day-list-scroll" tabIndex={0} role="region" aria-label={t('day.list')}>
              {day.isError || query.isError ? (
                <div className="day-empty">
                  <p role="alert">{t('social.today.loadFailed')}</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void query.refetch();
                      if (separate) void selected.refetch();
                    }}
                  >
                    {t('common.tryAgain')}
                  </Button>
                </div>
              ) : !day.data ? (
                <DaySkeleton />
              ) : !day.data.goals.length ? (
                <p className="day-empty">{t('social.today.noGoals')}</p>
              ) : (
                <FriendList groups={groups} onReport={me ? setReport : undefined} />
              )}
            </div>
          </main>
        )}
      </div>
      {report && me && (
        <ReportSheet
          client={client}
          me={me}
          person={{ userId: friendId, nickname: nickname ?? '' }}
          todo={report}
          onClose={() => setReport(null)}
          onBlocked={() => {
            setReport(null);
            onBlocked?.();
          }}
        />
      )}
    </div>
  );
}
