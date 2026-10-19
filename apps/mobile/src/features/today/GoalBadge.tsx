import { Pressable, StyleSheet, Text, View } from 'react-native';
import { goalInk, goalTint, type Goal } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';

/** GOAL-03/MOB-04: 사용자 색 대비를 core로 계산하고 선택 이름표도 44pt로 누르게 한다. */
export function GoalBadge({
  goal,
  onPress,
  selected = false,
  add = false,
  disabled = false,
  hint,
}: {
  goal: Goal;
  onPress?(): void;
  selected?: boolean;
  add?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const { colors, isDark } = useTheme();
  const badge = (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: goalTint(goal.color, colors.bg, isDark ? 0.22 : 0.14),
          opacity: goal.archivedAt === null ? 1 : m.pressedOpacity,
        },
      ]}
    >
      <Text style={[styles.text, { color: goalInk(goal.color, colors.bg, isDark) }]}>
        {goal.name}
        {add ? ' +' : ''}
      </Text>
    </View>
  );
  if (!onPress) return <View accessibilityLabel={goal.name}>{badge}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(add ? 'mobile.goal.add' : 'mobile.goal.select', { name: goal.name })}
      accessibilityHint={hint}
      disabled={disabled}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.touch,
        {
          opacity: pressed ? m.pressedOpacity : 1,
          borderColor: selected ? colors.ink : 'transparent',
        },
      ]}
    >
      {badge}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  touch: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    justifyContent: 'center',
    padding: m.selectionRing,
    borderWidth: m.selectionRing,
    borderRadius: m.radius.pill,
  },
  badge: {
    minHeight: m.height.chip,
    paddingHorizontal: m.space.md,
    paddingVertical: m.space.sm,
    justifyContent: 'center',
    borderRadius: m.radius.pill,
  },
  text: {
    fontFamily: m.fontBold,
    fontWeight: '700',
    fontSize: m.type.button,
    letterSpacing: m.letterSpacing.button,
  },
});
