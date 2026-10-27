import { Pressable, StyleSheet, Text, View } from 'react-native';
import { goalInk, type Goal } from '@nodii/core';
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
  onChip = false,
}: {
  goal: Goal;
  onPress?(): void;
  selected?: boolean;
  add?: boolean;
  disabled?: boolean;
  hint?: string;
  onChip?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const background = onChip ? colors.bg : colors.chip;
  const badge = (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: background,
          borderColor: selected ? goal.color : 'transparent',
          opacity: goal.archivedAt === null ? 1 : m.pressedOpacity,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: goal.color }]} />
      <Text style={[styles.text, { color: goalInk(goal.color, background, isDark) }]}>
        {goal.name}
      </Text>
      {add && <Text style={[styles.text, { color: colors.ink }]}> +</Text>}
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
          borderColor: 'transparent',
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
    padding: 0,
    borderRadius: m.radius.pill,
  },
  badge: {
    minHeight: m.height.chip,
    paddingHorizontal: m.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.goalDot,
    borderWidth: m.selectionRing,
    justifyContent: 'center',
    borderRadius: m.radius.pill,
  },
  dot: { width: m.glyph.dot, height: m.glyph.dot, borderRadius: m.radius.pill },
  text: {
    fontFamily: m.fontExtraBold,
    fontWeight: '800',
    fontSize: m.type.button,
    letterSpacing: m.letterSpacing.button,
  },
});
