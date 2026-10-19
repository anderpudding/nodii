import { useOnline } from '../../../lib/connectivity';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionInfo } from 'react-native';
import { checkColor, type Goal } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';

/** ROUT-05: 할 일과 루틴의 체크·제목은 같은 렌더러로 그려 모양이 갈라지지 않게 한다. */
export function DayRowContent({
  title,
  isDone,
  goal,
  locked,
  menuTestID,
  accessibilityActions,
  onToggle,
  onMenu,
  onAction,
}: {
  title: string;
  isDone: boolean;
  goal: Goal;
  locked: boolean;
  menuTestID: string;
  accessibilityActions: AccessibilityActionInfo[];
  onToggle(): void;
  onMenu(): void;
  onAction(name: string): void;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={t(isDone ? 'todo.uncomplete' : 'todo.complete', {
          title: title,
        })}
        accessibilityState={{
          checked: isDone,
          disabled: locked || !online,
          busy: locked,
        }}
        accessibilityHint={!online ? t('sync.writeDisabled') : undefined}
        disabled={locked || !online}
        onPress={onToggle}

        style={({ pressed }) => [
          styles.touch,
          {
            opacity: pressed || !online ? m.pressedOpacity : 1,
            borderColor: colors.bg,
          },
        ]}
      >
        <View
          style={[
            styles.box,
            {
              backgroundColor: isDone ? goal.color : colors.boxFill,
              borderColor: isDone ? goal.color : colors.field,
            },
          ]}
        >
          {isDone && (
            <Text accessible={false} style={[styles.check, { color: checkColor(goal.color) }]}>
              ✓
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable
        testID={menuTestID}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.menu.open', { title: title })}
        accessibilityState={{ disabled: locked, busy: locked }}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={(event) => onAction(event.nativeEvent.actionName)}
        disabled={locked}
        onPress={onMenu}

        style={({ pressed }) => [
          styles.titleTouch,
          {
            opacity: pressed ? m.pressedOpacity : 1,
            borderColor: colors.bg,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            {
              color: isDone ? colors.muted : colors.ink,
              textDecorationLine: isDone ? 'line-through' : 'none',
            },
          ]}
        >
          {title}
        </Text>
        {!online && (
          <Text
            style={{ color: colors.muted, fontFamily: m.fontMedium, fontSize: m.type.supporting }}
          >
            {t('sync.writeDisabled')}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { minHeight: m.height.field, flexDirection: 'row', alignItems: 'center' },
  touch: {
    width: m.height.touch,
    minHeight: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: m.selectionRing,
    borderRadius: m.radius.mark,
  },
  box: {
    width: m.glyph.check,
    height: m.glyph.check,
    borderWidth: m.border,
    borderRadius: m.radius.mark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontFamily: m.fontBold, fontSize: m.type.body, fontWeight: '700' },
  titleTouch: {
    flex: 1,
    minHeight: m.height.touch,
    justifyContent: 'center',
    borderWidth: m.selectionRing,
    borderRadius: m.radius.mark,
  },
  title: {
    paddingVertical: m.space.sm,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
  },
});
