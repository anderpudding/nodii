import { useEffect, useRef } from 'react';
import { addDays, monthKeyOf, occursOn, type Profile, type Routine } from '@nodii/core';
import { useMonthRoutineLogs, type NodiiClient, type RoutineRecord } from '@nodii/api';
import { Button } from '../../components/ui/button';
import { formatCalendarDate } from '../calendar/CalendarGrid';
import { formatRoutineRule } from './format-rule';

/** 지난 7일과 앞으로 7일을 비교해 기록 보존 범위를 선택한다 (ROUT-08). */
export function RoutineScope({
  before,
  after,
  today,
  client,
  profile,
  pending,
  onChoose,
  onCancel,
}: {
  before: RoutineRecord;
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
      <h2 id="routine-editor-title">반복 규칙을 바꿨어요. 어디부터 적용할까요?</h2>
      <p className="supporting">
        {formatRoutineRule(before, profile.weekStart)} →{' '}
        {formatRoutineRule(after, profile.weekStart)}
      </p>
      <p id="routine-scope-description" className="supporting">
        오늘부터를 고르면 어제까지의 기록과 표시는 그대로 남아요.
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
            {scope === 'today' ? '오늘부터' : '과거 날짜까지 모두'}
          </Button>
          <p className="supporting">
            {scope === 'today'
              ? `${formatCalendarDate(today)}부터 새 규칙으로 보여요. 새 시작일은 오늘이에요.`
              : '새 규칙에 맞지 않는 날의 완료 기록은 지우지 않고 숨겨요.'}
          </p>
          <div
            className="routine-scope-grid"
            aria-label={`${scope === 'today' ? '오늘부터' : '모두 적용'} 2주 미리보기`}
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
                ? '없음'
                : unavailable
                  ? '확인 중'
                  : log?.status === 'done'
                    ? '끝냄'
                    : log?.status === 'skipped'
                      ? '건너뜀'
                      : date < today
                        ? '기록 없음'
                        : '예정';
              return (
                <span
                  key={date}
                  className={`routine-scope-day${state === '끝냄' ? ' scope-done' : ''}`}
                  aria-label={`${formatCalendarDate(date)} ${state}`}
                >
                  <span>
                    {Number(date.slice(5, 7))}/{Number(date.slice(8))}
                  </span>
                  <span>{state}</span>
                </span>
              );
            })}
          </div>
        </section>
      ))}
      <p className="supporting">끝냄: 완료 기록 · 기록 없음: 지난 미완료 · 예정: 앞으로 할 루틴</p>
      {(past.isError || future.isError) && (
        <Button
          variant="ghost"
          onClick={() => {
            void past.refetch();
            void future.refetch();
          }}
        >
          기록을 불러오지 못했어요 · 다시 시도
        </Button>
      )}
      <Button ref={cancel} variant="ghost" disabled={pending} onClick={onCancel}>
        취소
      </Button>
    </>
  );
}
