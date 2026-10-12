import type { Goal, Routine } from '@nodii/core';
import { StyleSheet, View } from 'react-native';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { GoalBadge } from '../today/GoalBadge';
import { routineActions, routineActionLabel, type RoutineAction } from '../today/actions';
import { RoutineOption } from './RoutineOption';

/** MOB-01: 밀기와 같은 선언의 메뉴를 제공하며 관리 화면에서는 날짜 동작을 빼 둔다. */
export function RoutineMenu({
  routine,
  goal,
  isDone = false,
  skipped = false,
  managing = false,
  locked,
  onAction,
  onClose,
}: {
  routine: Routine;
  goal: Goal;
  isDone?: boolean;
  skipped?: boolean;
  managing?: boolean;
  locked: boolean;
  onAction(action: RoutineAction): void;
  onClose(): void;
}) {
  const { colors } = useTheme();
  return (
    <BottomSheet title={routine.title} testID="routine-menu-sheet" bottomCancel onClose={onClose}>
      <GoalBadge goal={goal} />
      {routineActions
        .filter(({ id }) => !managing || id === 'edit' || id === 'stop')
        .map(({ id }) => (
          <View key={id}>
            {id === 'stop' && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
            <RoutineOption
              label={routineActionLabel(id, isDone, skipped)}
              danger={id === 'stop'}
              disabled={locked}
              onPress={() => {
                onClose();
                onAction(id);
              }}
            />
          </View>
        ))}
    </BottomSheet>
  );
}
const styles = StyleSheet.create({ divider: { height: m.border, marginVertical: m.space.sm } });
