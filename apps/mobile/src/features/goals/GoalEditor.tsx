import { useQuery } from '@tanstack/react-query';
import { ManagementScreen } from '../../components/ManagementScreen';
import { VisibilityContext } from '../social/VisibilityContext';
import { GoalMark } from './GoalMark';
import { GoalRainbow } from './GoalRainbow';
import { GoalColorPicker } from './GoalColorPicker';
import { showPublishNotice } from './publish-notice';
import { useContext, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import {
  fetchProfile,
  OfflineWriteError,
  useCreateGoal,
  useGoalVisibility,
  useDeleteGoal,
  useGoalContents,
  type GoalRecord,
  type NodiiClient,
} from '@nodii/api';
import {
  checkColor,
  GOAL_NAME_MAX_LENGTH,
  isHexColor,
  keyBetween,
  lastSortKey,
  VISIBILITY_CHOICES,
  type DefaultVisibility,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { metrics as m, useTheme } from '../../../lib/theme';
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
  userId,
  goal,
  goals,
  onClose,
}: {
  client: NodiiClient;
  userId: string;
  goal: GoalRecord | null;
  goals: GoalRecord[];
  onClose(): void;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  const social = useContext(VisibilityContext);
  const account = useQuery({
    queryKey: ['profile', userId],
    enabled: social && !goal,
    queryFn: ({ signal }) => fetchProfile(client, userId, signal),
    staleTime: 30_000,
  });
  const [changedVisibility, setVisibility] = useState<DefaultVisibility>();
  const visibility =
    changedVisibility ?? goal?.visibility ?? account.data?.defaultVisibility ?? 'private';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [name, setName] = useState(goal?.name ?? '');
  const [color, setColor] = useState(goal?.color ?? '#4F7CFF');
  const [id] = useState(() => goal?.id ?? Crypto.randomUUID());
  const [focused, setFocused] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const guard = useRef(false);
  const saveError = (error: unknown) =>
    toast(() =>
      t(social && error instanceof OfflineWriteError ? 'sync.writeDisabled' : 'todo.save.failed'),
    );
  const create = useCreateGoal(client, { onError: saveError }, userId);
  const update = useGoalVisibility(client, id, { onError: saveError });
  const remove = useDeleteGoal(client, { onError: saveError });
  const counts = useGoalContents(client, userId);
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
    (!social || !!goal || !!account.data) &&
    name.trim().length > 0 &&
    name.trim().length <= GOAL_NAME_MAX_LENGTH &&
    isHexColor(color);
  const blocked = (!social && !online) || saving || actions.pending;
  function close() {
    if (guard.current) return;
    if (
      name === (goal?.name ?? '') &&
      color === (goal?.color ?? '#4F7CFF') &&
      changedVisibility === undefined
    ) {
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
          changes: {
            name: name.trim(),
            color: color.toUpperCase(),
            visibility: social ? changedVisibility : undefined,
          },
        });
      else
        await create.mutateAsync({
          id,
          name: name.trim(),
          color: color.toUpperCase(),
          visibility: social ? visibility : undefined,
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
    if (social && !online) {
      toast(() => t('sync.writeDisabled'));
      return;
    }
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
            if (guard.current) return;
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
  const title = t(goal ? 'goal.edit' : 'goal.add');
  const saveButton = (
    <Button
      label={t(social || goal ? 'mobile.rename.save' : 'goal.add')}
      disabled={!valid || blocked}
      busy={saving}
      onPress={() => void save()}
    />
  );
  const body = (
    <>
      {' '}
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
        selectionColor={isHexColor(color) ? color : colors.ink}
        onFocus={() => setFocused('name')}
        onBlur={() => setFocused(null)}
        style={[
          s.input,
          { borderWidth: 1.5 },
          {
            color: colors.ink,
            backgroundColor: colors.chip,
            borderColor: focused === 'name' ? colors.ink : colors.chip,
          },
        ]}
      />
      <Text style={[s.label, { color: colors.ink2 }]}>{t('goal.color')}</Text>
      {social ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: m.space.sm,
          }}
        >
          {[...goalPresets, null].map((preset) => {
            const custom = !goalPresets.some((option) => option.color === color);
            const selected = preset ? preset.color === color : custom;
            return (
              <Pressable
                key={preset?.color ?? 'custom'}
                accessibilityRole="button"
                accessibilityLabel={
                  preset ? t('goal.preset', { name: t(preset.name) }) : t('goal.colorPicker.open')
                }
                accessibilityState={{ selected }}
                disabled={blocked}
                onPress={() => (preset ? setColor(preset.color) : setPickerOpen(true))}
                style={{
                  flexBasis: '16.6%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: m.height.touch,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: m.radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: preset?.color,
                    borderWidth: selected ? m.selectionRing : 0,
                    borderColor: colors.ink,
                  }}
                >
                  {!preset && <GoalRainbow />}
                  {selected && (
                    <View
                      style={{
                        borderRadius: m.radius.pill,
                        minWidth: 24,
                        minHeight: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: color,
                      }}
                    >
                      <Text style={{ color: checkColor(color) }}>✓</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <View style={s.choices}>
            {goalPresets.map((preset) => (
              <RoutineOption
                key={preset.color}
                label={t(preset.name)}
                compact
                borderless
                multiple
                selected={color.toUpperCase() === preset.color}
                accessibilityLabel={t('goal.preset', { name: t(preset.name) })}
                disabled={blocked}
                onPress={() => setColor(preset.color)}
              >
                <GoalBadge
                  goal={{ ...draft, name: t(preset.name), color: preset.color }}
                  selected={color.toUpperCase() === preset.color}
                />
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
              { borderWidth: 1.5 },
              {
                color: colors.ink,
                backgroundColor: colors.chip,
                borderColor: !isHexColor(color)
                  ? colors.danger
                  : focused === 'color'
                    ? colors.ink
                    : colors.chip,
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
        </>
      )}
      {social && (
        <>
          <Text style={[s.label, { color: colors.ink2 }]}>{t('social.visibility.label')}</Text>
          <View
            accessibilityRole="radiogroup"
            style={{
              backgroundColor: colors.chip,
              borderRadius: m.radius.pill,
              flexDirection: 'row',
              padding: m.space.xs,
            }}
          >
            {VISIBILITY_CHOICES.map((choice) => (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ checked: choice === visibility }}
                disabled={blocked || (!goal && !account.data)}
                onPress={() => {
                  showPublishNotice(visibility, choice, toast);
                  setVisibility(choice);
                }}
                style={{
                  backgroundColor: choice === visibility ? colors.ink : colors.chip,
                  flex: 1,
                  minHeight: m.height.touch,
                  borderRadius: m.radius.pill,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: m.space.xs,
                }}
              >
                <GoalMark color={color} visibility={choice} selected={choice === visibility} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    color: choice === visibility ? colors.bg : colors.ink2,
                    fontFamily: m.fontExtraBold,
                    fontSize: m.type.button,
                  }}
                >
                  {t(`social.visibility.${choice}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          {visibility !== 'public' && (
            <Text style={[s.supporting, { color: colors.muted }]}>
              {t(`social.visibility.${visibility}Help`)}
            </Text>
          )}
          <GoalBadge
            goal={{ ...draft, name: name.trim() || t('goal.preview'), color, visibility }}
          />
          {!goal && account.isError && (
            <Button label={t('common.tryAgain')} secondary onPress={() => void account.refetch()} />
          )}
        </>
      )}
      {!social && !online && (
        <Text style={[s.supporting, { color: colors.muted }]}>{t('sync.writeDisabled')}</Text>
      )}
      {!social && saveButton}
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
    </>
  );
  if (social)
    return (
      <ManagementScreen
        inline
        title={title}
        back={t('goal.back')}
        onClose={close}
        testID="goal-editor-page"
        footer={saveButton}
      >
        {body}
        {pickerOpen && (
          <GoalColorPicker
            initial={color}
            onClose={() => setPickerOpen(false)}
            onApply={(value) => {
              setColor(value);
              setPickerOpen(false);
            }}
          />
        )}
      </ManagementScreen>
    );
  return (
    <BottomSheet title={title} testID="goal-editor-sheet" onClose={close} keyboard>
      {body}
    </BottomSheet>
  );
}
