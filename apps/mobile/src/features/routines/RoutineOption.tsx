import { type ReactNode } from 'react';
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
  accessibilityLabel = label,
  multiple = false,
  filled = false,
  segment = false,
  inline = false,
  borderless = false,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
  onPress(): void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
  multiple?: boolean;
  filled?: boolean;
  segment?: boolean;
  inline?: boolean;
  borderless?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : multiple ? 'checkbox' : 'radio'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected, checked: selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        compact && styles.compact,
        segment && styles.segment,
        inline && styles.inline,
        {
          backgroundColor: disabled
            ? colors.box
            : selected && (filled || segment)
              ? colors.ink
              : 'transparent',
          borderColor: selected && !filled && !segment ? colors.ink : 'transparent',
          borderWidth: !borderless && selected && !filled && !segment ? m.selectionRing : 0,
          opacity: pressed ? m.pressedOpacity : 1,
        },
      ]}
    >
      {!children && (
        <Text
          style={[
            styles.label,
            {
              color: disabled
                ? colors.muted
                : selected && (filled || segment)
                  ? colors.bg
                  : danger
                    ? colors.danger
                    : colors.ink,
            },
          ]}
        >
          {label}
        </Text>
      )}
      {description && (
        <Text
          style={[
            styles.supporting,
            { color: selected && (filled || segment) ? colors.bg : colors.ink2 },
          ]}
        >
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
  segment: { flex: 1, borderRadius: m.radius.pill },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: m.height.field,
  },
  label: { fontFamily: m.fontExtraBold, fontSize: m.type.button },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
});
