import { useId, useState } from 'react';
import {
  keyBetween,
  lastSortKey,
  needsScopePrompt,
  nextOccurrences,
  normalizeTitle,
  TITLE_MAX_LENGTH,
  validateRoutineRule,
  type Profile,
  type Routine,
  type RoutineRuleValidation,
} from '@nodii/core';
import {
  useRoutineWritePending,
  useCreateRoutine,
  useGoals,
  useRoutines,
  useUpdateRoutine,
  useSplitRoutine,
  type NodiiClient,
  type RoutineRecord,
} from '@nodii/api';
import { toast } from 'sonner';
import { Sheet } from '../../components/ui/sheet';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { notifyError } from '../../lib/notify-error';
import { useUIStore } from '../../stores/ui';
import { GoalChip, goalStyle } from '../goals/GoalChip';
import { formatCalendarDate } from '../calendar/CalendarGrid';
import { weekdays } from './format-rule';
import { RoutineScope } from './RoutineScope';
import { RoutineStopDialog } from './RoutineStopDialog';

const errors: Record<
  Extract<RoutineRuleValidation, { ok: false }>['reason'],
  { field: string; message: string }
> = {
  repeat_every_invalid: {
    field: 'interval',
    message: '간격은 1부터 365까지 정수로 입력해 주세요.',
  },
  weekday_required: { field: 'weekdays', message: '요일을 하나 이상 골라 주세요.' },
  weekday_invalid: { field: 'weekdays', message: '일요일부터 토요일 중에 골라 주세요.' },
  weekday_not_allowed: { field: 'weekdays', message: '요일은 매주 반복에서만 골라 주세요.' },
  monthday_required: { field: 'monthdays', message: '날짜를 하나 이상 골라 주세요.' },
  monthday_invalid: { field: 'monthdays', message: '1일부터 31일 중에 골라 주세요.' },
  monthday_not_allowed: { field: 'monthdays', message: '날짜는 매월 반복에서만 골라 주세요.' },
  start_date_invalid: { field: 'start', message: '시작일을 입력해 주세요.' },
  end_date_invalid: { field: 'end', message: '올바른 종료일을 입력해 주세요.' },
  end_before_start: { field: 'end', message: '종료일은 시작일보다 빠를 수 없어요.' },
};
/** 기존 규칙을 초안으로 편집하고 저장할 때만 캐시에 반영한다 (ROUT-01~04,08). */
export function RoutineEditor({
  client,
  profile,
  routine,
  goalId,
  onClose,
}: {
  client: NodiiClient;
  profile: Profile;
  routine?: RoutineRecord;
  goalId?: string;
  onClose: () => void;
}) {
  const { today, selectedDate } = useUIStore();
  const id = useId();
  const goals = useGoals(client);
  const routines = useRoutines(client);
  const activeGoals = (goals.data ?? []).filter((goal) => !goal.archivedAt);
  const [draft, setDraft] = useState<Routine>(
    () =>
      routine ?? {
        id: crypto.randomUUID(),
        title: '',
        goalId: goalId ?? '',
        freq: 'daily',
        repeatEvery: 1,
        byWeekday: null,
        byMonthday: null,
        startDate: selectedDate,
        endDate: null,
        sortKey: 'a0',
      },
  );
  const [scopeOpen, setScopeOpen] = useState(false);
  const [stop, setStop] = useState<'end' | 'delete' | null>(null);
  const selectedGoalId = draft.goalId || activeGoals[0]?.id || '';
  const goal = activeGoals.find((item) => item.id === selectedGoalId);
  const [splitId] = useState(() => crypto.randomUUID());
  const split = useSplitRoutine(client, splitId, { onError: notifyError });
  const create = useCreateRoutine(client, draft.id, { onError: notifyError });
  const update = useUpdateRoutine(client, draft.id, { onError: notifyError });
  const busy = useRoutineWritePending(draft.id);
  const validation = validateRoutineRule(draft);
  const error = validation.ok ? null : errors[validation.reason];
  const preview = validation.ok
    ? nextOccurrences(draft, today > draft.startDate ? today : draft.startDate, 5)
    : [];
  const canSave =
    !!normalizeTitle(draft.title) && !!goal && validation.ok && !!routines.data && !busy;
  function patch(changes: Partial<Routine>) {
    setDraft((value) => ({ ...value, ...changes }));
  }
  function toggle(field: 'byWeekday' | 'byMonthday', value: number) {
    const current = draft[field] ?? [];
    patch({
      [field]: current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value].sort((a, b) => a - b),
    });
  }
  const after = { ...draft, title: draft.title.trim(), goalId: selectedGoalId };
  function save(scope: 'all' | 'today') {
    if (!canSave) return;
    if (routine && scope === 'today' && needsScopePrompt(routine, after, today))
      split.mutate(
        { before: routine, after, today },
        {
          onSuccess: (result) => {
            if ('endDateError' in result)
              toast.error(
                '규칙은 바뀌었지만 종료일을 저장하지 못했어요. 다시 시도로 종료일만 저장할 수 있어요.',
              );
            onClose();
          },
        },
      );
    else if (routine) update.mutate({ before: routine, after }, { onSuccess: onClose });
    else
      create.mutate(
        {
          ...after,
          sortKey: keyBetween(
            lastSortKey((routines.data ?? []).filter((r) => r.goalId === selectedGoalId)),
            null,
          ),
        },
        { onSuccess: onClose },
      );
  }
  function fieldError(field: string) {
    return error?.field === field ? (
      <p id={`${id}-${field}-error`} role="alert" className="error-message">
        {error.message}
      </p>
    ) : null;
  }
  if (stop && routine)
    return (
      <RoutineStopDialog
        routine={routine}
        client={client}
        deleting={stop === 'delete'}
        onClose={onClose}
      />
    );
  return (
    <Sheet
      className="routine-modal scroll-sheet"
      role={scopeOpen ? 'alertdialog' : 'dialog'}
      labelledBy="routine-editor-title"
      describedBy={scopeOpen ? 'routine-scope-description' : undefined}
      onClose={() => {
        if (busy) return;
        if (scopeOpen) setScopeOpen(false);
        else onClose();
      }}
    >
      {scopeOpen && routine ? (
        <div className="sheet-body routine-form-body">
          <RoutineScope
            before={routine}
            after={after}
            today={today}
            client={client}
            profile={profile}
            pending={busy}
            onChoose={save}
            onCancel={() => setScopeOpen(false)}
          />
        </div>
      ) : (
        <form
          className="routine-form"
          noValidate
          onKeyDown={(event) => {
            // 한글 조합을 확정하는 Enter로 루틴이 저장되지 않게 한다.
            if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
              event.preventDefault();
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSave) return;
            if (routine && needsScopePrompt(routine, after, today)) setScopeOpen(true);
            else save('all');
          }}
        >
          <header className="routine-heading">
            <h2 id="routine-editor-title">{routine ? '루틴 수정' : '루틴 추가'}</h2>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              닫기
            </Button>
          </header>
          <div className="sheet-body routine-form-body">
            <div className="field-group">
              <label htmlFor={`${id}-title`}>제목</label>
              <Input
                id={`${id}-title`}
                value={draft.title}
                maxLength={TITLE_MAX_LENGTH}
                disabled={busy}
                placeholder="어떤 일을 반복할까요?"
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>
            <fieldset className="routine-fieldset" disabled={busy}>
              <legend>목표</legend>
              <div className="routine-choices">
                {activeGoals.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="routine-goal-option"
                    aria-pressed={item.id === selectedGoalId}
                    onClick={() => patch({ goalId: item.id })}
                  >
                    <GoalChip goal={item} surface />
                  </button>
                ))}
              </div>
              {!goal && <p className="error-message">활성 목표를 골라 주세요.</p>}
            </fieldset>
            {goals.isError && (
              <Button variant="ghost" onClick={() => void goals.refetch()}>
                목표를 불러오지 못했어요 · 다시 시도
              </Button>
            )}
            <fieldset className="routine-fieldset" disabled={busy}>
              <legend id={`${id}-frequency`}>반복</legend>
              <div
                className="routine-segments"
                role="radiogroup"
                aria-labelledby={`${id}-frequency`}
              >
                {(['daily', 'weekly', 'monthly'] as const).map((freq, i) => (
                  <Button
                    key={freq}
                    variant="ghost"
                    role="radio"
                    aria-checked={draft.freq === freq}
                    tabIndex={draft.freq === freq ? 0 : -1}
                    onKeyDown={(event) => {
                      const offset = ['ArrowRight', 'ArrowDown'].includes(event.key)
                        ? 1
                        : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                          ? -1
                          : 0;
                      if (!offset) return;
                      event.preventDefault();
                      const next =
                        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                          '[role="radio"]',
                        )[(i + offset + 3) % 3];
                      next?.focus();
                      next?.click();
                    }}
                    onClick={() =>
                      patch({
                        freq,
                        byWeekday: freq === 'weekly' ? (draft.byWeekday ?? []) : null,
                        byMonthday: freq === 'monthly' ? (draft.byMonthday ?? []) : null,
                      })
                    }
                  >
                    {['매일', '매주', '매월'][i]}
                  </Button>
                ))}
              </div>
            </fieldset>
            <div className="field-group">
              <label htmlFor={`${id}-interval`}>반복 간격</label>
              <div className="routine-interval">
                <Button
                  variant="outline"
                  aria-label="반복 간격 줄이기"
                  disabled={busy || draft.repeatEvery <= 1}
                  onClick={() => patch({ repeatEvery: Math.max(1, draft.repeatEvery - 1) })}
                >
                  −
                </Button>
                <Input
                  id={`${id}-interval`}
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={Number.isNaN(draft.repeatEvery) ? '' : draft.repeatEvery}
                  disabled={busy}
                  aria-invalid={error?.field === 'interval'}
                  aria-describedby={
                    error?.field === 'interval' ? `${id}-interval-error` : undefined
                  }
                  onChange={(e) => patch({ repeatEvery: e.target.valueAsNumber })}
                />
                <Button
                  variant="outline"
                  aria-label="반복 간격 늘리기"
                  disabled={busy || draft.repeatEvery >= 365}
                  onClick={() =>
                    patch({ repeatEvery: Math.min(365, (draft.repeatEvery || 0) + 1) })
                  }
                >
                  +
                </Button>
                <span>
                  {draft.freq === 'daily'
                    ? '일마다'
                    : draft.freq === 'weekly'
                      ? '주마다'
                      : '개월마다'}
                </span>
              </div>
              {fieldError('interval')}
            </div>
            {draft.freq === 'weekly' && (
              <fieldset
                className="routine-fieldset"
                disabled={busy}
                aria-describedby={error?.field === 'weekdays' ? `${id}-weekdays-error` : undefined}
              >
                <legend>요일</legend>
                <div className="routine-days">
                  {Array.from({ length: 7 }, (_, i) => (i + profile.weekStart) % 7).map((day) => (
                    <Button
                      key={day}
                      variant={draft.byWeekday?.includes(day) ? 'default' : 'outline'}
                      aria-label={`${weekdays[day]}요일`}
                      aria-pressed={draft.byWeekday?.includes(day) ?? false}
                      onClick={() => toggle('byWeekday', day)}
                    >
                      {weekdays[day]}
                    </Button>
                  ))}
                </div>
                {fieldError('weekdays')}
              </fieldset>
            )}
            {draft.freq === 'monthly' && (
              <fieldset
                className="routine-fieldset"
                disabled={busy}
                aria-describedby={
                  error?.field === 'monthdays' ? `${id}-monthdays-error` : undefined
                }
              >
                <legend>날짜</legend>
                <div className="routine-days">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <Button
                      key={day}
                      variant={draft.byMonthday?.includes(day) ? 'default' : 'outline'}
                      aria-label={`${day}일`}
                      aria-pressed={draft.byMonthday?.includes(day) ?? false}
                      onClick={() => toggle('byMonthday', day)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
                {fieldError('monthdays')}
                <p className="supporting">없는 달은 말일에 표시돼요.</p>
              </fieldset>
            )}
            <div className="routine-dates">
              <div className="field-group">
                <label htmlFor={`${id}-start`}>시작일</label>
                <Input
                  id={`${id}-start`}
                  type="date"
                  value={draft.startDate}
                  disabled={busy}
                  aria-invalid={error?.field === 'start'}
                  aria-describedby={error?.field === 'start' ? `${id}-start-error` : undefined}
                  onChange={(e) => patch({ startDate: e.target.value })}
                />
                {fieldError('start')}
              </div>
              <div className="field-group">
                <label htmlFor={`${id}-end`}>종료일 (선택)</label>
                <Input
                  id={`${id}-end`}
                  type="date"
                  value={draft.endDate ?? ''}
                  disabled={busy}
                  aria-invalid={error?.field === 'end'}
                  aria-describedby={error?.field === 'end' ? `${id}-end-error` : undefined}
                  onChange={(e) => patch({ endDate: e.target.value || null })}
                />
                {fieldError('end')}
              </div>
            </div>
            <section
              className="routine-preview"
              aria-label="다음 5회 미리보기"
              aria-live="polite"
              style={goal ? goalStyle(goal.color, true) : undefined}
            >
              <h3>다음 5회 미리보기</h3>
              {error ? (
                <p className="supporting">{error.message}</p>
              ) : (
                <>
                  <div className="routine-choices">
                    {preview.map((date, i) => (
                      <span className={i === 0 ? 'goal-chip' : 'routine-preview-date'} key={date}>
                        {formatCalendarDate(date)}
                      </span>
                    ))}
                  </div>
                  {preview.length < 5 && (
                    <p className="supporting">
                      {draft.endDate
                        ? '종료일까지 예정된 날짜만 보여드려요.'
                        : '앞으로 3년 안에 예정된 날짜를 보여드려요.'}
                    </p>
                  )}
                </>
              )}
            </section>
            {routines.isError && (
              <Button variant="ghost" onClick={() => void routines.refetch()}>
                루틴을 불러오지 못했어요 · 다시 시도
              </Button>
            )}
          </div>
          <div className="routine-actions">
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={!canSave}>
              {busy ? '저장 중…' : '저장'}
            </Button>
          </div>
          {routine && (
            <div className="routine-destructive">
              <Button
                variant="ghost"
                disabled={busy || (routine.endDate !== null && routine.endDate < today)}
                onClick={() => setStop('end')}
              >
                오늘부터 그만하기
              </Button>
              <Button
                variant="ghost"
                className="danger-text"
                disabled={busy}
                onClick={() => setStop('delete')}
              >
                완전 삭제
              </Button>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}
