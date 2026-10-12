import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  useGoals,
  useGoalContents,
  type GoalRecord,
  type GoalContents,
  type NodiiClient,
} from '@nodii/api';
import { compareSortKey } from '@nodii/core';
import { t } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { metrics as m, useTheme } from '../../../lib/theme';
import { ManagementScreen } from '../../components/ManagementScreen';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { SwipeableRow } from '../../components/gestures/SwipeableRow';
import { GoalBadge } from '../today/GoalBadge';
import { splitSwipeActions } from '../today/actions';
import { RoutineOption } from '../routines/RoutineOption';
import { settingsStyles as s } from '../settings/styles';
import { goalActions, droppedGoalIndex, isLastActiveGoal, type GoalAction } from './model';
import { useGoalActions } from './useGoalActions';
import { GoalEditor } from './GoalEditor';

/** GOAL-01~07: 활성 목록·추가·편집·보관함은 같은 Query 데이터를 공유하는 네 화면이다. */
export function Goals({ client, onClose }: { client: NodiiClient; onClose(): void }) {
  const { colors } = useTheme();
  const online = useOnline();
  const goals = useGoals(client);
  const contents = useGoalContents(client);
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<GoalRecord | null | undefined>(undefined);
  const heights = useRef<Record<string, number>>({});
  const rows = (goals.data ?? [])
    .filter((goal) => !goal.deletedAt)
    .sort((a, b) => compareSortKey(a.sortKey, b.sortKey));
  const active = rows.filter((goal) => !goal.archivedAt);
  const archive = rows.filter((goal) => !!goal.archivedAt);
  return (
    <ManagementScreen
      title={t(archived ? 'goal.archived.title' : 'goal.manage')}
      back={t(archived ? 'goal.back' : 'settings.back')}
      testID="goals-screen"
      swipeRows
      onClose={() => {
        if (archived) setArchived(false);
        else onClose();
      }}
      footer={
        !archived && (
          <Button
            label={t('goal.add')}
            disabled={!online || goals.isPending || goals.isError}
            onPress={() => setEditing(null)}
          />
        )
      }
    >
      <Text accessibilityRole="header" style={[s.label, { color: colors.ink2 }]}>
        {t(archived ? 'goal.archived.help' : 'goal.total', { count: active.length })}
      </Text>
      {(goals.isPending || goals.isError) && (
        <Text style={[s.supporting, { color: colors.muted }]}>
          {t(goals.isError ? 'goal.failed' : 'mobile.today.loading')}
        </Text>
      )}
      {goals.isError && (
        <Button secondary label={t('common.tryAgain')} onPress={() => void goals.refetch()} />
      )}
      {contents.isError && (
        <>
          <Text style={{ color: colors.danger }}>{t('goal.counts.failed')}</Text>
          <Button label={t('common.tryAgain')} secondary onPress={() => void contents.refetch()} />
        </>
      )}
      {!online && (
        <Text style={[s.supporting, { color: colors.muted }]}>{t('sync.writeDisabled')}</Text>
      )}
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {(archived ? archive : active).map((goal, index) => (
          <GoalRow
            key={goal.id}
            client={client}
            goal={goal}
            contents={contents.data?.[goal.id]}
            last={isLastActiveGoal(rows, goal.id)}
            onEdit={() => setEditing(goal)}
            onHeight={(height) => {
              heights.current[goal.id] = height;
            }}
            dropIndex={(distance) =>
              droppedGoalIndex(
                active.map((row) => heights.current[row.id] ?? m.height.field),
                index,
                distance,
              )
            }
            active={active}
          />
        ))}
      </View>
      {archived && !archive.length && (
        <Text style={[s.supporting, { color: colors.muted }]}>{t('goal.archived.empty')}</Text>
      )}
      {!archived && (
        <>
          <Text style={[s.supporting, { color: colors.muted }]}>{t('goal.swipeHelp')}</Text>
          <RoutineOption
            inline
            label={t('goal.archived.title')}
            description={t('settings.management.count', { count: archive.length })}
            onPress={() => setArchived(true)}
          />
        </>
      )}
      {editing !== undefined && (
        <GoalEditor
          client={client}
          goal={editing}
          goals={rows}
          onClose={() => setEditing(undefined)}
        />
      )}
    </ManagementScreen>
  );
}
function GoalRow({
  client,
  goal,
  contents,
  last,
  onEdit,
  onHeight,
  dropIndex,
  active,
}: {
  client: NodiiClient;
  goal: GoalRecord;
  contents?: GoalContents;
  last: boolean;
  onEdit(): void;
  onHeight(height: number): void;
  dropIndex(distance: number): number;
  active: GoalRecord[];
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  const actions = useGoalActions(client, goal);
  const [menu, setMenu] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [focused, setFocused] = useState(false);
  const archived = !!goal.archivedAt;
  const labels = {
    edit: t('goal.edit'),
    reorder: t('goal.reorder'),
    archive: t('goal.archive'),
    delete: t('goal.delete'),
  };
  function run(id: GoalAction) {
    if (!online || actions.pending) return;
    if ((id === 'archive' || id === 'delete') && actions.last()) {
      toast(t('goal.lastActive'));
      return;
    }
    setMenu(false);
    if (id === 'archive') void actions.archive(true).catch(() => {});
    else if (id === 'reorder') setOrdering(true);
    else onEdit();
  }
  const swipe = splitSwipeActions(
    goalActions.map(({ id, swipe }) => ({
      id,
      swipe: id === 'archive' && last ? null : swipe,
      label: labels[id],
      background: colors.side,
      color: colors.ink,
      run: () => run(id),
    })),
    'none',
  );
  const body = (
    <View
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={[
        s.row,
        s.horizontal,
        {
          backgroundColor: colors.surface,
          borderColor: focused ? colors.focus : colors.line,
          borderWidth: m.selectionRing,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('goal.row', {
          name: goal.name,
          todos: contents?.todos ?? 0,
          routines: contents?.routines ?? 0,
        })}
        accessibilityHint={
          !online ? t('sync.writeDisabled') : last ? t('goal.lastActive') : t('goal.swipeHelp')
        }
        onPress={onEdit}
        onLongPress={() => setMenu(true)}
        disabled={actions.pending}
        accessibilityActions={goalActions
          .filter(({ id }) => !archived || id === 'edit' || id === 'delete')
          .map(({ id }) => ({ name: id, label: labels[id] }))}
        onAccessibilityAction={(event) => {
          const action = goalActions.find(({ id }) => id === event.nativeEvent.actionName);
          if (action) run(action.id);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: m.space.sm,
            minHeight: m.height.touch,
            opacity: pressed ? m.pressedOpacity : 1,
          },
        ]}
      >
        <GoalBadge goal={goal} />
        <View style={{ flex: 1 }}>
          <Text style={[s.supporting, { color: colors.muted }]}>
            {contents ? t('goal.contents', { ...contents }) : t('goal.counts.loading')}
          </Text>
          {archived && (
            <Text style={[s.supporting, { color: colors.muted }]}>
              {t('goal.archived.date', {
                date: new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(
                  new Date(goal.archivedAt!),
                ),
              })}
            </Text>
          )}
        </View>
        {!archived && <Text style={{ color: colors.muted }}>›</Text>}
      </Pressable>
      {archived && (
        <Button
          secondary
          label={t('goal.unarchive')}
          disabled={!online || actions.pending}
          onPress={() => void actions.archive(false).catch(() => {})}
        />
      )}
    </View>
  );
  return (
    <>
      {archived ? (
        body
      ) : (
        <SwipeableRow
          id={`goal-${goal.id}`}
          disabled={!online || actions.pending}
          trailing={swipe.trailing}
          onMenu={() => setMenu(true)}
          onUnavailableSwipe={last ? () => toast(t('goal.lastActive')) : undefined}
          onReorder={(distance) => void actions.reorder(dropIndex(distance))}
        >
          {body}
        </SwipeableRow>
      )}
      {menu && (
        <BottomSheet
          title={goal.name}
          testID="goal-menu-sheet"
          bottomCancel
          onClose={() => setMenu(false)}
        >
          {!online && <Text style={{ color: colors.muted }}>{t('sync.writeDisabled')}</Text>}
          {goalActions
            .filter(({ id }) => !archived || id === 'edit' || id === 'delete')
            .map(({ id }) => (
              <RoutineOption
                key={id}
                label={labels[id]}
                danger={id === 'delete'}
                description={
                  (id === 'archive' || id === 'delete') && last ? t('goal.lastActive') : undefined
                }
                disabled={
                  !online || actions.pending || ((id === 'archive' || id === 'delete') && last)
                }
                onPress={() => run(id)}
              />
            ))}
        </BottomSheet>
      )}
      {ordering && (
        <BottomSheet
          title={t('goal.reorder')}
          testID="goal-reorder-sheet"
          bottomCancel
          onClose={() => setOrdering(false)}
        >
          {active.map((row, index) => (
            <RoutineOption
              key={row.id}
              label={t('goal.reorder.position', { position: index + 1, name: row.name })}
              disabled={!online || actions.pending}
              onPress={() => {
                setOrdering(false);
                void actions.reorder(index);
              }}
            />
          ))}
        </BottomSheet>
      )}
    </>
  );
}
