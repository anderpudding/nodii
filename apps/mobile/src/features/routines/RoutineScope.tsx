import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ISODate, Routine, RoutineLog } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { RoutineOption } from './RoutineOption';
import { routineDate, ruleLabel, scopePreview } from './model';
import { routineStyles as s } from './styles';

/** ROUT-08: 날짜별 결과를 보고 기존 split RPC와 전체 업데이트를 선택한다. */
export function RoutineScope({
  before,
  after,
  today,
  weekStart,
  logs,
  busy,
  onApply,
  previewLoading,
  previewError,
  onRetry,
  onClose,
}: {
  before: Routine;
  after: Routine;
  today: ISODate;
  weekStart: 0 | 1;
  logs: readonly RoutineLog[];
  busy: boolean;
  previewLoading: boolean;
  previewError: boolean;
  onRetry(): void;
  onApply(scope: 'today' | 'all'): void;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const [scope, setScope] = useState<'today' | 'all'>('today');
  // 종료된 루틴이나 과거 종료일 초안은 기존 RPC가 오늘 분할을 허용하지 않는다.
  const canSplit =
    (before.endDate === null || before.endDate >= today) &&
    (after.endDate === null || after.endDate >= today);
  const blocked = scope === 'today' && !canSplit;
  return (
    <BottomSheet
      title={t('routine.scope.title')}
      testID="routine-scope-sheet"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Text style={[s.supporting, { color: colors.ink2 }]}>
        {ruleLabel(before)} · {routineDate(before.startDate)} → {ruleLabel(after)} ·{' '}
        {routineDate(after.startDate)}
      </Text>
      {(['today', 'all'] as const).map((value) => (
        <View key={value}>
          <RoutineOption
            label={t(value === 'today' ? 'routine.scope.today' : 'routine.scope.all')}
            description={t(
              value === 'today' ? 'routine.scope.todayDescription' : 'routine.scope.allDescription',
              { date: routineDate(value === 'today' ? today : after.startDate) },
            )}
            selected={scope === value}
            disabled={busy}
            onPress={() => setScope(value)}
          />
          <View
            accessibilityLabel={t(value === 'today' ? 'routine.scope.today' : 'routine.scope.all')}
            style={styles.calendar}
          >
            {scopePreview(before, after, today, weekStart, logs, value).map(({ date, state }) => (
              <View
                key={date}
                accessible
                accessibilityLabel={t('routine.scope.cell', {
                  date: routineDate(date),
                  state: t(`routine.scope.${state}`),
                })}
                style={[
                  styles.cell,
                  {
                    borderColor: state === 'planned' ? colors.line2 : colors.surface,
                    backgroundColor:
                      state === 'done'
                        ? colors.ink
                        : state === 'missing'
                          ? colors.stamp
                          : colors.surface,
                  },
                ]}
              >
                <Text
                  style={[styles.number, { color: state === 'done' ? colors.bg : colors.ink2 }]}
                >
                  {Number(date.slice(-2))}
                </Text>
                <Text
                  accessible={false}
                  style={[styles.number, { color: state === 'done' ? colors.bg : colors.ink2 }]}
                >
                  {state === 'done'
                    ? '✓'
                    : state === 'missing'
                      ? '—'
                      : state === 'planned'
                        ? '○'
                        : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <View style={s.choices}>
        {(['done', 'missing', 'planned'] as const).map((state, i) => (
          <Text key={state} style={[s.supporting, { color: colors.ink2 }]}>
            {['✓', '—', '○'][i]} {t(`routine.scope.${state}`)}
          </Text>
        ))}
      </View>
      {(previewLoading || previewError) && (
        <Text
          accessibilityRole={previewError ? 'alert' : undefined}
          style={[s.supporting, { color: previewError ? colors.danger : colors.muted }]}
        >
          {t(previewError ? 'mobile.calendar.failed' : 'mobile.calendar.loading')}
        </Text>
      )}
      {previewError && <Button label={t('common.tryAgain')} secondary onPress={onRetry} />}
      {blocked && (
        <Text accessibilityRole="alert" style={[s.supporting, { color: colors.danger }]}>
          {t('routine.scope.ended')}
        </Text>
      )}
      <RoutineOption label={t('mobile.add.cancel')} disabled={busy} onPress={onClose} />
      <Button
        label={t(scope === 'today' ? 'routine.scope.applyToday' : 'routine.scope.applyAll')}
        disabled={busy || blocked || previewLoading || previewError}
        busy={busy}
        onPress={() => onApply(scope)}
      />
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  calendar: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: m.space.sm },
  cell: {
    width: `${100 / 7}%`,
    minHeight: m.height.touch,
    borderWidth: m.border,
    borderRadius: m.radius.stamp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontFamily: m.fontSemiBold, fontSize: m.type.label, fontVariant: ['tabular-nums'] },
});
