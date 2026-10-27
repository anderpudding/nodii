import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { metrics as m, useTheme } from '../../lib/theme';

/** MOB-04: 글자 버튼에도 44pt 터치 영역과 누름 피드백을 제공한다. */
export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  secondary = false,
  pill = false,
  accessibilityLabel = label,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  pill?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: pill ? m.radius.pill : m.radius.button,
          minHeight: secondary ? m.height.touch : m.height.button,
          backgroundColor: disabled ? colors.box : secondary ? colors.chip : colors.ink,
          borderColor: secondary ? colors.bg : colors.ink,
          opacity: pressed ? m.pressedOpacity : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={disabled ? colors.muted : secondary ? colors.ink : colors.bg} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: disabled ? colors.muted : secondary ? colors.ink : colors.bg },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minWidth: m.height.touch,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: m.radius.button,
    borderWidth: 0,
    paddingHorizontal: m.space.lg,
    paddingVertical: m.space.sm,
  },
  label: {
    fontFamily: m.fontExtraBold,
    fontSize: m.type.button,
    fontWeight: '800',
    letterSpacing: m.letterSpacing.button,
    textAlign: 'center',
  },
});
