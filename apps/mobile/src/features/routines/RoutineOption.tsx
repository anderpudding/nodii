import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { metrics as m, useTheme } from '../../../lib/theme';

/** MOB-04: 시트 선택지에도 44pt·포커스·선택 상태를 함께 제공한다. */
export function RoutineOption({
  label,
  description,
  children,
  onPress,
  disabled = false,
  danger = false,
  selected,
  compact = false,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
  onPress(): void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected, checked: selected }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.option,
        compact && styles.compact,
        {
          backgroundColor: selected ? colors.ink : colors.surface,
          borderColor: focused ? colors.focus : selected ? colors.ink : colors.field,
          opacity: pressed || disabled ? m.pressedOpacity : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? colors.bg : danger ? colors.danger : colors.ink },
        ]}
      >
        {label}
      </Text>
      {description && (
        <Text style={[styles.supporting, { color: selected ? colors.bg : colors.ink2 }]}>
          {description}
        </Text>
      )}
      {children && <View>{children}</View>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  option: {
    minHeight: m.height.menu,
    borderWidth: m.selectionRing,
    borderRadius: m.radius.card,
    padding: m.space.lg,
    gap: m.space.sm,
  },
  compact: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
    padding: m.space.xs,
    borderRadius: m.radius.pill,
  },
  label: { fontFamily: m.fontBold, fontSize: m.type.button },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
});
