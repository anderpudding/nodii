import { t, type MessageKey } from '@nodii/i18n';
import { useId, useState } from 'react';
import {
  keyBetween,
  lastSortKey,
  needsScopePrompt,
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
import { weekdayShort } from '../../lib/weekday';
import { RoutineScope } from './RoutineScope';
import { RoutineStopDialog } from './RoutineStopDialog';

const errors: Record<
  Extract<RoutineRuleValidation, { ok: false }>['reason'],
  { field: string; messageKey: MessageKey }
> = {
  repeat_every_invalid: {
    field: 'interval',
    messageKey: 'routine.validation.repeatEvery',
  },
  weekday_required: { field: 'weekdays', messageKey: 'routine.validation.weekdayRequired' },
  weekday_invalid: { field: 'weekdays', messageKey: 'routine.validation.weekday' },
  weekday_not_allowed: { field: 'weekdays', messageKey: 'routine.validation.weekdayNotAllowed' },
  monthday_required: { field: 'monthdays', messageKey: 'routine.validation.monthdayRequired' },
  monthday_invalid: { field: 'monthdays', messageKey: 'routine.validation.monthday' },
  monthday_not_allowed: { field: 'monthdays', messageKey: 'routine.validation.monthdayNotAllowed' },
  start_date_invalid: { field: 'start', messageKey: 'routine.validation.start' },
  end_date_invalid: { field: 'end', messageKey: 'routine.validation.end' },
  end_before_start: { field: 'end', messageKey: 'routine.validation.endBeforeStart' },
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
            if ('endDateError' in result) toast.error(t('routine.partialSplit.retry'));
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
        {t(error.messageKey)}
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
            goalColor={goal?.color}
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
            <h2 id="routine-editor-title">{routine ? t('routine.edit') : t('routine.create')}</h2>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              {t('mobile.add.discard.action')}
            </Button>
          </header>
          <div className="sheet-body routine-form-body">
            <div className="field-group">
              <label htmlFor={`${id}-title`}>{t('routine.titleLabel')}</label>
              <Input
                id={`${id}-title`}
                value={draft.title}
                maxLength={TITLE_MAX_LENGTH}
                disabled={busy}
                placeholder={t('routine.title.placeholder')}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>
            <fieldset className="routine-fieldset" disabled={busy}>
              <legend>{t('goal.label')}</legend>
              <div className="routine-choices">
                {activeGoals.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="routine-goal-option"
                    style={goalStyle(item.color)}
                    aria-pressed={item.id === selectedGoalId}
                    onClick={() => patch({ goalId: item.id })}
                  >
                    <GoalChip goal={item} />
                  </button>
                ))}
              </div>
              {!goal && <p className="error-message">{t('routine.goal.required')}</p>}
            </fieldset>
            {goals.isError && (
              <Button variant="ghost" onClick={() => void goals.refetch()}>
                {t('routine.goal.failed')}
              </Button>
            )}
            <fieldset className="routine-fieldset" disabled={busy}>
              <legend id={`${id}-frequency`}>{t('routine.repeat')}</legend>
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
                    {[t('routine.daily'), t('routine.weekly'), t('routine.monthly')][i]}
                  </Button>
                ))}
              </div>
            </fieldset>
            <div className="field-group">
              <label htmlFor={`${id}-interval`}>{t('routine.repeat.interval')}</label>
              <div className="routine-interval">
                <Button
                  variant="outline"
                  aria-label={t('routine.decrease')}
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
                  aria-label={t('routine.increase')}
                  disabled={busy || draft.repeatEvery >= 365}
                  onClick={() =>
                    patch({ repeatEvery: Math.min(365, (draft.repeatEvery || 0) + 1) })
                  }
                >
                  +
                </Button>
                <span>
                  {draft.freq === 'daily'
                    ? t('routine.interval.days')
                    : draft.freq === 'weekly'
                      ? t('routine.interval.weeks')
                      : t('routine.interval.months')}
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
                <legend>{t('routine.weekdays')}</legend>
                <div className="routine-days">
                  {Array.from({ length: 7 }, (_, i) => (i + profile.weekStart) % 7).map((day) => (
                    <Button
                      key={day}
                      variant={draft.byWeekday?.includes(day) ? 'default' : 'outline'}
                      aria-label={t('routine.weekday.label', { day: weekdayShort(day) })}
                      aria-pressed={draft.byWeekday?.includes(day) ?? false}
                      onClick={() => toggle('byWeekday', day)}
                    >
                      {weekdayShort(day)}
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
                <legend>{t('routine.monthdays')}</legend>
                <div className="routine-days">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <Button
                      key={day}
                      variant={draft.byMonthday?.includes(day) ? 'default' : 'outline'}
                      aria-label={t('routine.monthday.label', { day })}
                      aria-pressed={draft.byMonthday?.includes(day) ?? false}
                      onClick={() => toggle('byMonthday', day)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
                {fieldError('monthdays')}
                <p className="supporting">{t('routine.monthEnd.help')}</p>
              </fieldset>
            )}
            <div className="routine-dates">
              <div className="field-group">
                <label htmlFor={`${id}-start`}>{t('routine.start')}</label>
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
                <label htmlFor={`${id}-end`}>{t('routine.end.optional')}</label>
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
            {routines.isError && (
              <Button variant="ghost" onClick={() => void routines.refetch()}>
                {t('routine.load.retry')}
              </Button>
            )}
          </div>
          <div className="routine-actions">
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!canSave}>
              {busy ? t('common.saving') : t('common.save')}
            </Button>
          </div>
          {routine && (
            <div className="routine-destructive">
              <Button
                variant="ghost"
                disabled={busy || (routine.endDate !== null && routine.endDate < today)}
                onClick={() => setStop('end')}
              >
                {t('routine.endToday')}
              </Button>
              <Button
                variant="ghost"
                className="danger-text"
                disabled={busy}
                onClick={() => setStop('delete')}
              >
                {t('routine.delete.action')}
              </Button>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}
