import { useRef, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import {
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useGoalContents,
  type GoalRecord,
  type NodiiClient,
} from '@nodii/api';
import { GOAL_NAME_MAX_LENGTH, isHexColor, keyBetween, lastSortKey } from '@nodii/core';
import { t } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { GoalBadge } from '../today/GoalBadge';
import { RoutineOption } from '../routines/RoutineOption';
import { routineStyles as s } from '../routines/styles';
import { isLastActiveGoal } from './model';
import { useGoalActions } from './useGoalActions';
import { goalPresets } from './presets';

/** GOAL-01/02/03/06: 이름·색 입력과 개수 확인을 별도 편집 시트에서 처리한다. */
export function GoalEditor({
  client,
  goal,
  goals,
  onClose,
}: {
  client: NodiiClient;
  goal: GoalRecord | null;
  goals: GoalRecord[];
  onClose(): void;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  const [name, setName] = useState(goal?.name ?? '');
  const [color, setColor] = useState(goal?.color ?? '#4F7CFF');
  const [id] = useState(() => goal?.id ?? Crypto.randomUUID());
  const [focused, setFocused] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const guard = useRef(false);
  const create = useCreateGoal(client, { onError: () => toast(t('todo.save.failed')) });
  const update = useUpdateGoal(client, id, { onError: () => toast(t('todo.save.failed')) });
  const remove = useDeleteGoal(client, { onError: () => toast(t('todo.save.failed')) });
  const counts = useGoalContents(client);
  const draft: GoalRecord = goal ?? {
    id,
    name: '',
    color: '#4F7CFF',
    sortKey: 'a0',
    archivedAt: null,
    deletedAt: null,
    updatedAt: '',
  };
  const actions = useGoalActions(client, draft);
  const last = isLastActiveGoal(goals, id);
  const valid =
    name.trim().length > 0 && name.trim().length <= GOAL_NAME_MAX_LENGTH && isHexColor(color);
  const blocked = !online || saving || actions.pending;
  function close() {
    if (guard.current) return;
    if (name === (goal?.name ?? '') && color === (goal?.color ?? '#4F7CFF')) {
      onClose();
      return;
    }
    Alert.alert(t('mobile.add.discard.title'), t('mobile.add.discard.description'), [
      { text: t('mobile.add.discard.continue'), style: 'cancel' },
      { text: t('mobile.add.discard.action'), style: 'destructive', onPress: onClose },
    ]);
  }
  async function save() {
    if (!valid || blocked || guard.current) return;
    guard.current = true;
    setSaving(true);
    try {
      if (goal)
        await update.mutateAsync({
          goal,
          changes: { name: name.trim(), color: color.toUpperCase() },
        });
      else
        await create.mutateAsync({
          id,
          name: name.trim(),
          color: color.toUpperCase(),
          archivedAt: null,
          sortKey: keyBetween(lastSortKey(goals), null),
        });
      onClose();
    } catch {
      /* 입력을 유지하고 훅의 롤백·토스트를 사용한다. */
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }
  async function archive() {
    if (blocked || last || guard.current) return;
    guard.current = true;
    setSaving(true);
    try {
      await actions.archive(true);
      onClose();
    } catch {
      /* 공용 훅에서 안내한다. */
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }
  function confirmDelete() {
    if (!goal || !counts.data || counts.isError || blocked || last || guard.current) return;
    const count = counts.data[goal.id];
    if (!count) return;
    Alert.alert(
      t('goal.delete.title', { name: goal.name }),
      t('goal.delete.description', { ...count }),
      [
        ...(!goal.archivedAt
          ? [{ text: t('goal.delete.archiveInstead'), onPress: () => void archive() }]
          : []),
        { text: t('mobile.add.cancel'), style: 'cancel' },
        {
          text: t('todo.action.delete'),
          style: 'destructive',
          onPress: () => {
            if (guard.current || !online) return;
            guard.current = true;
            setSaving(true);
            void remove
              .mutateAsync(goal)
              .then(onClose)
              .catch(() => {})
              .finally(() => {
                guard.current = false;
                setSaving(false);
              });
          },
        },
      ],
    );
  }
  return (
    <BottomSheet
      title={t(goal ? 'goal.edit' : 'goal.add')}
      testID="goal-editor-sheet"
      onClose={close}
      keyboard
    >
      <Text style={[s.label, { color: colors.ink2 }]}>{t('goal.name')}</Text>
      <TextInput
        autoFocus
        accessibilityLabel={t('goal.name')}
        placeholder={t('goal.name.placeholder')}
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        maxLength={GOAL_NAME_MAX_LENGTH}
        editable={!blocked}
        onFocus={() => setFocused('name')}
        onBlur={() => setFocused(null)}
        style={[
          s.input,
          { color: colors.ink, borderColor: focused === 'name' ? colors.focus : colors.field },
        ]}
      />
      <Text style={[s.label, { color: colors.ink2 }]}>{t('goal.color')}</Text>
      <View style={s.choices}>
        {goalPresets.map((preset) => (
          <RoutineOption
            key={preset.color}
            label={t(preset.name)}
            compact
            multiple
            selected={color.toUpperCase() === preset.color}
            accessibilityLabel={t('goal.preset', { name: t(preset.name) })}
            disabled={blocked}
            onPress={() => setColor(preset.color)}
          >
            <GoalBadge goal={{ ...draft, name: t(preset.name), color: preset.color }} />
          </RoutineOption>
        ))}
      </View>
      <TextInput
        accessibilityLabel={t('goal.hex')}
        autoCapitalize="characters"
        autoCorrect={false}
        value={color}
        onChangeText={setColor}
        editable={!blocked}
        onFocus={() => setFocused('color')}
        onBlur={() => setFocused(null)}
        style={[
          s.input,
          {
            color: colors.ink,
            borderColor: !isHexColor(color)
              ? colors.danger
              : focused === 'color'
                ? colors.focus
                : colors.field,
          },
        ]}
      />
      {!isHexColor(color) ? (
        <Text accessibilityRole="alert" style={[s.supporting, { color: colors.danger }]}>
          {t('goal.hex.invalid')}
        </Text>
      ) : (
        <GoalBadge goal={{ ...draft, name: name.trim() || t('goal.preview'), color }} />
      )}
      {!online && (
        <Text style={[s.supporting, { color: colors.muted }]}>{t('sync.writeDisabled')}</Text>
      )}
      <Button
        label={t(goal ? 'mobile.rename.save' : 'goal.add')}
        disabled={!valid || blocked}
        busy={saving}
        onPress={() => void save()}
      />
      {goal && (
        <>
          {last && (
            <Text style={[s.supporting, { color: colors.muted }]}>{t('goal.lastActive')}</Text>
          )}
          {!goal.archivedAt && (
            <RoutineOption
              label={t('goal.archive')}
              description={t('goal.archive.description')}
              disabled={blocked || last}
              onPress={() => void archive()}
            />
          )}
          <RoutineOption
            label={t('goal.delete')}
            danger
            description={
              counts.data?.[id]
                ? t('goal.contents', { ...counts.data[id]! })
                : t('goal.counts.loading')
            }
            disabled={blocked || last || !counts.data?.[id] || counts.isError}
            onPress={confirmDelete}
          />
          {counts.isError && (
            <Button label={t('common.tryAgain')} secondary onPress={() => void counts.refetch()} />
          )}
        </>
      )}
    </BottomSheet>
  );
}
