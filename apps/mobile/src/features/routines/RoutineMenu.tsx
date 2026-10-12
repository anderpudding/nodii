import { useState } from 'react';
import type { Goal, Routine } from '@nodii/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { GoalBadge } from '../today/GoalBadge';
import { routineActions, routineActionLabel, type RoutineAction } from '../today/actions';

/** MOB-01: 같은 선언의 동작을 할 일 메뉴와 같은 높이·글리프·구분선으로 노출한다. */
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
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <BottomSheet title={routine.title} testID="routine-menu-sheet" bottomCancel onClose={onClose}>
      <GoalBadge goal={goal} />
      {routineActions
        .filter(({ id }) => !managing || id === 'edit' || id === 'stop')
        .map(({ id }) => (
          <View key={id}>
            {id === 'stop' && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={routineActionLabel(id, isDone, skipped)}
              accessibilityState={{ disabled: locked, busy: locked }}
              disabled={locked}
              onPress={() => {
                onClose();
                onAction(id);
              }}
              onFocus={() => setFocused(id)}
              onBlur={() => setFocused(null)}
              style={({ pressed }) => [
                styles.item,
                {
                  borderColor: focused === id ? colors.focus : colors.surface,
                  borderBottomColor: colors.line,
                  opacity: pressed || locked ? m.pressedOpacity : 1,
                },
              ]}
            >
              <RoutineGlyph action={id} color={id === 'stop' ? colors.danger : colors.ink} />
              <Text style={[styles.label, { color: id === 'stop' ? colors.danger : colors.ink }]}>
                {routineActionLabel(id, isDone, skipped)}
              </Text>
            </Pressable>
          </View>
        ))}
    </BottomSheet>
  );
}
function RoutineGlyph({ action, color }: { action: RoutineAction; color: string }) {
  return (
    <View accessible={false} style={styles.glyph}>
      {action === 'toggle' ? (
        <View style={[styles.tick, { borderColor: color }]} />
      ) : action === 'edit' ? (
        <View style={[styles.pencil, { borderColor: color }]} />
      ) : action === 'skip' ? (
        <View style={[styles.arrow, { borderColor: color }]} />
      ) : (
        <View style={[styles.stop, { borderColor: color }]} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  divider: { height: m.border, marginVertical: m.space.sm },
  item: {
    minHeight: m.height.menu,
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.lg,
    borderWidth: m.selectionRing,
    borderBottomWidth: m.border,
    paddingHorizontal: m.space.xs,
    paddingVertical: m.space.sm,
  },
  label: { fontFamily: m.fontMedium, fontSize: m.type.body, flexShrink: 1 },
  glyph: {
    width: m.glyph.icon,
    height: m.glyph.icon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: m.space.sm,
    height: m.space.md,
    borderRightWidth: m.selectionRing,
    borderBottomWidth: m.selectionRing,
    transform: [{ rotate: '45deg' }],
  },
  pencil: {
    width: m.space.sm,
    height: m.glyph.icon,
    borderWidth: m.selectionRing,
    transform: [{ rotate: '45deg' }],
  },
  arrow: {
    width: m.space.md,
    height: m.space.md,
    borderRightWidth: m.selectionRing,
    borderTopWidth: m.selectionRing,
    transform: [{ rotate: '45deg' }],
  },
  stop: { width: m.space.md, height: m.space.md, borderWidth: m.selectionRing },
});
