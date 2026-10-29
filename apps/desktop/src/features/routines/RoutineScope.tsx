import { t } from '@nodii/i18n';
import { useEffect, useRef } from 'react';
import { addDays, monthKeyOf, occursOn, type Profile, type Routine } from '@nodii/core';
import { useMonthRoutineLogs, type NodiiClient, type RoutineRecord } from '@nodii/api';
import { CalendarStamp } from '../calendar/CalendarStamp';
import { Button } from '../../components/ui/button';
import { formatCalendarDate } from '../calendar/CalendarGrid';
import { formatRoutineRule } from './format-rule';

const stateKeys = {
  none: 'routine.noEnd',
  checking: 'routine.scope.checking',
  done: 'routine.scope.completed',
  skipped: 'routine.skipped.label',
  missing: 'routine.scope.missing',
  planned: 'routine.scope.planned',
} as const;

/** 지난 7일과 앞으로 7일을 비교해 기록 보존 범위를 선택한다 (ROUT-08). */
export function RoutineScope({
  before,
  after,
  goalColor,
  today,
  client,
  profile,
  pending,
  onChoose,
  onCancel,
}: {
  before: RoutineRecord;
  goalColor?: string;
  after: Routine;
  today: string;
  client: NodiiClient;
  profile: Profile;
  pending: boolean;
  onChoose: (scope: 'all' | 'today') => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
  }, []);
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i - 7));
  const past = useMonthRoutineLogs(client, monthKeyOf(dates[0]!), profile.weekStart);
  const future = useMonthRoutineLogs(client, monthKeyOf(dates[13]!), profile.weekStart);
  const logs = [...(past.data ?? []), ...(future.data ?? [])];
  const unavailable = past.isPending || future.isPending || past.isError || future.isError;
  return (
    <>
      <h2 id="routine-editor-title">{t('routine.scope.title')}</h2>
      <p className="supporting">
        {formatRoutineRule(before, profile.weekStart)} →{' '}
        {formatRoutineRule(after, profile.weekStart)}
      </p>
      <p id="routine-scope-description" className="supporting">
        {t('routine.scope.help')}
      </p>
      {(['today', 'all'] as const).map((scope) => (
        <section key={scope} className="routine-scope-option">
          <Button
            className="full-width"
            variant={scope === 'today' ? 'default' : 'outline'}
            disabled={
              pending ||
              (scope === 'today' &&
                ((before.endDate !== null && before.endDate < today) ||
                  (after.endDate !== null && after.endDate < today)))
            }
            onClick={() => onChoose(scope)}
          >
            {scope === 'today' ? t('routine.scope.today') : t('routine.scope.all')}
          </Button>
          <p className="supporting">
            {scope === 'today'
              ? t('routine.scope.todayHelp', { date: formatCalendarDate(today) })
              : t('routine.scope.allHelp')}
          </p>
          <div
            className="routine-scope-grid"
            aria-label={t(
              scope === 'today' ? 'routine.scope.preview.today' : 'routine.scope.preview.all',
            )}
          >
            {dates.map((date) => {
              const rule =
                scope === 'today'
                  ? date < today
                    ? before
                    : { ...after, startDate: today }
                  : after;
              const occurs = occursOn(rule, date);
              const log = logs.find((row) => row.routineId === before.id && row.date === date);
              const state = !occurs
                ? 'none'
                : unavailable
                  ? 'checking'
                  : log?.status === 'done'
                    ? 'done'
                    : log?.status === 'skipped'
                      ? 'skipped'
                      : date < today
                        ? 'missing'
                        : 'planned';
              return (
                <span
                  key={date}
                  className={`routine-scope-day${state === 'done' ? ' scope-done' : ''}`}
                  aria-label={t('routine.scope.dateState', {
                    date: formatCalendarDate(date),
                    state: t(stateKeys[state]),
                  })}
                >
                  <CalendarStamp
                    summary={
                      occurs && state !== 'skipped'
                        ? { total: 1, remaining: state === 'done' ? 0 : 1 }
                        : undefined
                    }
                    future={date > today}
                    today={date === today}
                    colors={goalColor ? [goalColor] : []}
                  />
                  <span>
                    {Number(date.slice(5, 7))}/{Number(date.slice(8))}
                  </span>
                  <span>{t(stateKeys[state])}</span>
                </span>
              );
            })}
          </div>
        </section>
      ))}
      <p className="supporting">{t('routine.scope.legend')}</p>
      {(past.isError || future.isError) && (
        <Button
          variant="ghost"
          onClick={() => {
            void past.refetch();
            void future.refetch();
          }}
        >
          {t('routine.scope.failed')}
        </Button>
      )}
      <Button ref={cancel} variant="ghost" disabled={pending} onClick={onCancel}>
        {t('mobile.add.cancel')}
      </Button>
    </>
  );
}
