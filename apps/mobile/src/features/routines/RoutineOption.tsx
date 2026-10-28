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
  descriptionBelow = false,
  labelColor,
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
  descriptionBelow?: boolean;
  labelColor?: string;
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
        inline && descriptionBelow && styles.stacked,
        {
          backgroundColor: disabled
            ? colors.box
            : selected && (filled || segment)
              ? colors.ink
              : 'transparent',
          borderColor:
            filled && !selected ? colors.line2 : selected && !segment ? colors.ink : 'transparent',
          borderWidth:
            borderless || segment ? 0 : filled ? m.border : selected ? m.selectionRing : 0,
          borderBottomColor: inline ? colors.line : undefined,
          opacity: pressed ? m.pressedOpacity : 1,
        },
      ]}
    >
      {!children && (
        <Text
          style={[
            styles.label,
            inline && styles.inlineLabel,
            {
              color: disabled
                ? colors.muted
                : selected && (filled || segment)
                  ? colors.bg
                  : danger
                    ? colors.danger
                    : (labelColor ?? colors.ink),
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
            inline && !descriptionBelow && styles.value,
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
  segment: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', borderRadius: m.radius.pill },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: m.height.field,
    paddingVertical: m.space.sm,
    borderRadius: 0,
    borderBottomWidth: m.border,
  },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: m.space.xs },
  inlineLabel: { fontFamily: m.fontFamily, fontSize: m.type.body },
  value: { fontFamily: m.fontFamily, fontSize: m.type.body, flexShrink: 1 },
  label: { fontFamily: m.fontExtraBold, fontSize: m.type.button },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
});
