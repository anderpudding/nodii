import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { goalInk, goalTint, type Goal } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';

/** GOAL-03/MOB-04: 사용자 색 대비를 core로 계산하고 선택 이름표도 44pt로 누르게 한다. */
export function GoalBadge({
  goal,
  onPress,
  selected = false,
}: {
  goal: Goal;
  onPress?(): void;
  selected?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
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
      </Text>
    </View>
  );
  if (!onPress) return <View accessibilityLabel={goal.name}>{badge}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mobile.goal.select', { name: goal.name })}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.touch,
        {
          opacity: pressed ? m.pressedOpacity : 1,
          borderColor: focused ? colors.focus : selected ? goal.color : colors.surface,
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
