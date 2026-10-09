import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { metrics as m, useTheme } from '../../lib/theme';

/** MOB-04: 글자 버튼에도 44pt 터치 영역과 포커스 표시를 제공한다. */
export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  secondary = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: secondary ? m.height.touch : m.height.field,
          backgroundColor: secondary ? colors.bg : colors.ink,
          borderColor: focused ? colors.focus : secondary ? colors.bg : colors.ink,
          opacity: pressed || disabled ? m.pressedOpacity : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.ink : colors.bg} />
      ) : (
        <Text style={[styles.label, { color: secondary ? colors.ink2 : colors.bg }]}>{label}</Text>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: m.radius.button,
    borderWidth: m.focusRing,
    paddingHorizontal: m.space.lg,
    paddingVertical: m.space.sm,
  },
  label: {
    fontFamily: m.fontBold,
    fontSize: m.type.button,
    fontWeight: '700',
    letterSpacing: m.letterSpacing.button,
    textAlign: 'center',
  },
});
