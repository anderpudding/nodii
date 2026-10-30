import { useOnline } from '../../../lib/connectivity';
import { useRef, useState } from 'react';
import { Alert, Keyboard, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import {
  monthRoutineLogsOptions,
  useCreateRoutine,
  useUpdateRoutine,
  useSplitRoutine,
  useRoutineWritePending,
  type NodiiClient,
  type RoutineRecord,
} from '@nodii/api';
import {
  addDays,
  monthKeyOf,
  keyBetween,
  lastSortKey,
  weekdayOf,
  type Goal,
  type ISODate,
  type Routine,
  type RoutineFreq,
} from '@nodii/core';
import { t, weekdayName } from '@nodii/i18n';
import { useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { DatePickSheet } from '../today/DatePickSheet';
import { mergeWeekTodos, weekRange } from '../today/model';
import { GoalBadge } from '../today/GoalBadge';
import { RoutineOption } from './RoutineOption';
import { RoutineScope } from './RoutineScope';
import { routineStyles as s } from './styles';
import { routineDate, shouldAskScope, validateForm, weekdayOrder } from './model';

/** ROUT-01~04/08: 공용 규칙 검증과 기존 날짜 시트·쓰기 훅만 사용한다. */
export function RoutineEditor({
  client,
  routine,
  routines,
  goals,
  date,
  today,
  weekStart,
  timeZone = 'UTC',
  onClose,
}: {
  client: NodiiClient;
  routine: RoutineRecord | null;
  routines: RoutineRecord[];
  goals: Goal[];
  date: ISODate;
  today: ISODate;
  weekStart: 0 | 1;
  timeZone?: string;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  const active = goals.filter((goal) => goal.archivedAt === null);
  const [newId] = useState(randomUUID);
  const [initial] = useState<Routine>(
    () =>
      routine ?? {
        id: newId,
        goalId: active[0]?.id ?? '',
        title: '',
        freq: 'daily',
        repeatEvery: 1,
        byWeekday: null,
        byMonthday: null,
        startDate: date,
        endDate: null,
        sortKey: keyBetween(
          lastSortKey(routines.filter((row) => row.goalId === active[0]?.id)),
          null,
        ),
      },
  );
  const [draft, setDraft] = useState(initial);
  const [picking, setPicking] = useState<'startDate' | 'endDate' | null>(null);
  const [scope, setScope] = useState(false);
  const previewFrom = weekRange(today, weekStart).from;
  const previewTo = addDays(previewFrom, 13);
  const previewFirst = useQuery({
    ...monthRoutineLogsOptions(client, monthKeyOf(previewFrom), weekStart),
    enabled: scope,
  });
  const previewLast = useQuery({
    ...monthRoutineLogsOptions(client, monthKeyOf(previewTo), weekStart),
    enabled: scope,
  });
  const [saving, setSaving] = useState(false);
  const [partialSplit, setPartialSplit] = useState<RoutineRecord | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const guard = useRef(false);
  const errors = { onError: () => toast(() => t('todo.save.failed')) };
  const create = useCreateRoutine(client, newId, errors);
  const update = useUpdateRoutine(client, routine?.id ?? newId, errors);
  const split = useSplitRoutine(client, newId, errors);
  const finishSplit = useUpdateRoutine(client, newId, errors);
  const pending = useRoutineWritePending(routine?.id ?? newId);
  const blocked = saving || pending;
  const validation = validateForm(
    draft,
    active.map((goal) => goal.id),
  );
  const ruleError = !validation.rule.ok ? t(`routine.invalid.${validation.rule.reason}`) : null;
  const selectorError =
    !validation.rule.ok &&
    ['weekday_required', 'monthday_required', 'weekday_invalid', 'monthday_invalid'].includes(
      validation.rule.reason,
    );
  function close() {
    if (guard.current || blocked) return;
    if (JSON.stringify(draft) === JSON.stringify(initial)) {
      onClose();
      return;
    }
    Alert.alert(t('mobile.add.discard.title'), t('mobile.add.discard.description'), [
      { text: t('mobile.add.discard.continue'), style: 'cancel' },
      { text: t('mobile.add.discard.action'), style: 'destructive', onPress: onClose },
    ]);
  }
  function changeFreq(freq: RoutineFreq) {
    setDraft((value) => ({
      ...value,
      freq,
      byWeekday: freq === 'weekly' ? [weekdayOf(value.startDate)] : null,
      byMonthday: freq === 'monthly' ? [Number(value.startDate.slice(-2))] : null,
    }));
  }
  function toggle(field: 'byWeekday' | 'byMonthday', day: number) {
    setDraft((value) => {
      const selected = value[field] ?? [];
      return {
        ...value,
        [field]: selected.includes(day)
          ? selected.filter((current) => current !== day)
          : [...selected, day].sort((a, b) => a - b),
      };
    });
  }
  async function save(range?: 'today' | 'all') {
    if (!online || guard.current || blocked || !validation.valid) return;
    if (routine && !range && shouldAskScope(routine, draft, today)) {
      Keyboard.dismiss();
      setScope(true);
      return;
    }
    guard.current = true;
    setSaving(true);
    const after = { ...draft, title: validation.title! };
    try {
      if (!routine)
        await create.mutateAsync({
          ...after,
          sortKey: keyBetween(
            lastSortKey(routines.filter((row) => row.goalId === after.goalId)),
            null,
          ),
        });
      else if (range === 'today') {
        const result = await split.mutateAsync({ before: routine, after, today });
        if ('endDateError' in result) {
          setPartialSplit(result.routine);
          setScope(false);
          return;
        }
      } else await update.mutateAsync({ before: routine, after });
      onClose();
    } catch {
      /* 훅이 롤백·토스트를 처리하며 초안과 선택 범위는 유지한다. */
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }
  if (partialSplit)
    return (
      <BottomSheet
        title={t('routine.edit')}
        testID="routine-partial-sheet"
        onClose={() => {
          if (!guard.current) onClose();
        }}
      >
        <Text accessibilityRole="alert" style={[s.supporting, { color: colors.danger }]}>
          {t('routine.partialSplit')}
        </Text>
        <Button
          label={t('common.tryAgain')}
          disabled={blocked}
          busy={blocked}
          onPress={() => {
            if (guard.current) return;
            guard.current = true;
            setSaving(true);
            void finishSplit
              .mutateAsync({
                before: partialSplit,
                after: { ...partialSplit, endDate: draft.endDate },
              })
              .then(onClose)
              .catch(() => {
                /* 오류는 훅에서 안내한다. */
              })
              .finally(() => {
                guard.current = false;
                setSaving(false);
              });
          }}
        />
      </BottomSheet>
    );
  if (scope && routine) {
    const logs = mergeWeekTodos(
      previewFrom,
      previewTo,
      previewFirst.data ?? [],
      previewLast.data ?? [],
    );
    return (
      <RoutineScope
        before={routine}
        after={draft}
        today={today}
        weekStart={weekStart}
        logs={logs}
        goals={goals}
        timeZone={timeZone}
        busy={!online || blocked}
        previewLoading={previewFirst.isPending || previewLast.isPending}
        previewError={previewFirst.isError || previewLast.isError}
        onRetry={() => {
          void previewFirst.refetch();
          void previewLast.refetch();
        }}
        onClose={() => {
          if (!guard.current) setScope(false);
        }}
        onApply={(range) => void save(range)}
      />
    );
  }
  return (
    <>
      <BottomSheet
        title={t(routine ? 'routine.edit' : 'routine.create')}
        testID="routine-edit-sheet"
        keyboard
        onClose={close}
        header={
          <View style={s.header}>
            <Button
              label={t('mobile.add.cancel')}
              secondary
              quiet
              disabled={blocked}
              onPress={close}
            />
            <Text
              numberOfLines={2}
              adjustsFontSizeToFit
              accessibilityRole="header"
              style={[s.heading, { color: colors.ink }]}
            >
              {t(routine ? 'routine.edit' : 'routine.create')}
            </Text>
            <Button
              label={t('mobile.rename.save')}
              quiet
              disabled={!online || blocked || !validation.valid}
              busy={blocked}
              onPress={() => void save()}
            />
          </View>
        }
      >
        <View style={s.group}>
          <Text style={[s.label, { color: colors.ink2 }]}>{t('routine.titleLabel')}</Text>
          {!online && (
            <Text style={[s.supporting, { color: colors.muted }]}>{t('sync.writeDisabled')}</Text>
          )}
          <TextInput
            accessibilityLabel={t('routine.title')}
            value={draft.title}
            editable={!blocked}
            onChangeText={(title) => setDraft((value) => ({ ...value, title }))}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            selectionColor={goals.find((goal) => goal.id === draft.goalId)?.color ?? colors.ink}
            style={[
              s.input,
              { borderWidth: 1.5 },
              {
                color: colors.ink,
                backgroundColor: colors.chip,
                borderColor: inputFocused ? colors.ink : colors.chip,
              },
            ]}
          />
          {!validation.title && draft.title.length > 0 && (
            <Text accessibilityRole="alert" style={[s.supporting, { color: colors.danger }]}>
              {t('mobile.rename.invalid')}
            </Text>
          )}
        </View>
        <View style={s.group}>
          <Text style={[s.label, { color: colors.ink2 }]}>{t('routine.goal')}</Text>
          <View style={s.choices}>
            {active.map((goal) => (
              <RoutineOption
                key={goal.id}
                label={t('mobile.goal.select', { name: goal.name })}
                selected={draft.goalId === goal.id}
                disabled={blocked}
                onPress={() => setDraft((value) => ({ ...value, goalId: goal.id }))}
                compact
                borderless
              >
                <GoalBadge goal={goal} selected={draft.goalId === goal.id} />
              </RoutineOption>
            ))}
          </View>
          {!validation.goalValid && (
            <Text accessibilityRole="alert" style={[s.supporting, { color: colors.danger }]}>
              {t('routine.goalRequired')}
            </Text>
          )}
        </View>
        <View style={s.group}>
          <Text style={[s.label, { color: colors.ink2 }]}>{t('routine.repeat')}</Text>
          <View
            accessibilityRole="radiogroup"
            style={[s.segment, { backgroundColor: colors.chip }]}
          >
            {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
              <RoutineOption
                key={freq}
                label={t(freq === 'daily' ? 'mobile.routine.daily' : `routine.${freq}`)}
                selected={draft.freq === freq}
                disabled={blocked}
                onPress={() => changeFreq(freq)}
                segment
                compact
              />
            ))}
          </View>
        </View>
        <View style={s.group}>
          <Text style={[s.label, { color: colors.ink2 }]}>{t('routine.interval')}</Text>
          <View style={s.stepper}>
            <Button
              label="−"
              accessibilityLabel={t('routine.decrease')}
              secondary
              disabled={blocked || draft.repeatEvery <= 1}
              onPress={() =>
                setDraft((value) => ({ ...value, repeatEvery: value.repeatEvery - 1 }))
              }
            />
            <Text style={[s.supporting, { color: colors.ink }]}>
              {t(
                draft.repeatEvery === 1
                  ? `mobile.routine.interval.${draft.freq}`
                  : draft.freq === 'daily'
                    ? 'routine.everyDays'
                    : draft.freq === 'weekly'
                      ? 'routine.everyWeeks'
                      : 'routine.everyMonths',
                { every: draft.repeatEvery },
              )}
            </Text>
            <Button
              label="+"
              accessibilityLabel={t('routine.increase')}
              secondary
              disabled={blocked || draft.repeatEvery >= 365}
              onPress={() =>
                setDraft((value) => ({ ...value, repeatEvery: value.repeatEvery + 1 }))
              }
            />
          </View>
        </View>
        {draft.freq !== 'daily' && (
          <View style={s.group}>
            <Text style={[s.label, { color: colors.ink2 }]}>
              {t(draft.freq === 'weekly' ? 'routine.weekdays' : 'routine.monthdays')}
            </Text>
            <View style={s.choices}>
              {(draft.freq === 'weekly'
                ? weekdayOrder(weekStart)
                : Array.from({ length: 31 }, (_, i) => i + 1)
              ).map((day) => (
                <RoutineOption
                  key={day}
                  label={
                    draft.freq === 'weekly'
                      ? weekdayName(day as 0 | 1 | 2 | 3 | 4 | 5 | 6, 'short')
                      : `${day}`
                  }
                  labelColor={
                    draft.freq === 'weekly'
                      ? day === 0
                        ? colors.sun
                        : day === 6
                          ? colors.sat
                          : colors.ink
                      : colors.ink
                  }
                  multiple
                  filled
                  accessibilityLabel={t(
                    draft.freq === 'weekly' ? 'routine.weekdaySelect' : 'routine.monthdaySelect',
                    {
                      day:
                        draft.freq === 'weekly'
                          ? weekdayName(day as 0 | 1 | 2 | 3 | 4 | 5 | 6, 'long')
                          : day,
                    },
                  )}
                  selected={
                    (draft.freq === 'weekly' ? draft.byWeekday : draft.byMonthday)?.includes(day) ??
                    false
                  }
                  disabled={blocked}
                  onPress={() => toggle(draft.freq === 'weekly' ? 'byWeekday' : 'byMonthday', day)}
                  compact
                />
              ))}
            </View>
            {selectorError && (
              <Text accessibilityRole="alert" style={[s.supporting, { color: colors.danger }]}>
                {ruleError}
              </Text>
            )}
            {draft.freq === 'monthly' && (
              <Text style={[s.supporting, { color: colors.muted }]}>{t('routine.monthEnd')}</Text>
            )}
          </View>
        )}
        <View style={s.group}>
          <Text style={[s.label, { color: colors.ink2 }]}>{t('routine.period')}</Text>
          <View style={[s.period, { backgroundColor: colors.chip }]}>
            <RoutineOption
              inline
              label={t('routine.start')}
              description={`${routineDate(draft.startDate)} ›`}
              disabled={blocked}
              onPress={() => {
                Keyboard.dismiss();
                setPicking('startDate');
              }}
            />
            <RoutineOption
              inline
              label={t('routine.end')}
              description={`${draft.endDate ? routineDate(draft.endDate) : t('routine.noEnd')} ›`}
              disabled={blocked}
              onPress={() => {
                Keyboard.dismiss();
                setPicking('endDate');
              }}
            />
          </View>
          {draft.endDate && (
            <Button
              label={t('routine.clearEnd')}
              secondary
              disabled={blocked}
              onPress={() => setDraft((value) => ({ ...value, endDate: null }))}
            />
          )}
          {ruleError && !selectorError && (
            <Text accessibilityRole="alert" style={[s.supporting, { color: colors.danger }]}>
              {ruleError}
            </Text>
          )}
        </View>
      </BottomSheet>
      {picking && (
        <DatePickSheet
          client={client}
          title={t(picking === 'startDate' ? 'routine.start' : 'routine.end')}
          date={draft[picking] ?? today}
          allowSameDate={picking === 'endDate' && draft.endDate === null}
          today={today}
          weekStart={weekStart}
          timeZone={timeZone}
          onClose={() => setPicking(null)}
          onSelect={(next) => setDraft((value) => ({ ...value, [picking]: next }))}
        />
      )}
    </>
  );
}
