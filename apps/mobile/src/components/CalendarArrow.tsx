import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../lib/theme';

/** MOB-04/CAL-01: 이전·다음 달 글리프에도 44pt 터치 영역과 포커스를 유지한다. */
export function CalendarArrow({ direction, onPress }: { direction: -1 | 1; onPress(): void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(direction === -1 ? 'calendar.previousMonth' : 'calendar.nextMonth')}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: focused ? colors.focus : 'transparent',
          opacity: pressed ? m.pressedOpacity : 1,
        },
      ]}
    >
      <View
        accessible={false}
        style={[
          styles.chevron,
          {
            borderColor: colors.ink2,
            transform: [{ rotate: direction === -1 ? '135deg' : '-45deg' }],
          },
        ]}
      />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    width: m.height.touch,
    minHeight: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: m.selectionRing,
    borderRadius: m.radius.field,
  },
  chevron: {
    width: m.space.sm,
    height: m.space.sm,
    borderRightWidth: m.selectionRing,
    borderBottomWidth: m.selectionRing,
  },
});
