import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';

interface CalendarViewProps {
  expanded: boolean;
  onExpanded(value: boolean): void;
}

/** MOB-02: 주간·월간 선택은 읽기 전용 화면에서도 같은 터치 영역을 쓴다. */
export function CalendarViewSwitch({ expanded, onExpanded }: CalendarViewProps) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={[s.segment, { backgroundColor: colors.chip }]}>
      {([false, true] as const).map((option) => (
        <Pressable
          key={String(option)}
          hitSlop={{ top: m.space.xs, bottom: m.space.xs }}
          accessibilityRole="radio"
          accessibilityLabel={t(option ? 'mobile.view.month' : 'mobile.view.week')}
          accessibilityState={{ checked: expanded === option }}
          onPress={() => onExpanded(option)}
          style={({ pressed }) => [s.option, { opacity: pressed ? m.pressedOpacity : 1 }]}
        >
          <Text
            style={[
              s.letter,
              expanded === option
                ? { color: colors.bg, backgroundColor: colors.ink }
                : { color: colors.ink2 },
            ]}
          >
            {option ? 'M' : 'W'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** SOC-32: 하루 메뉴 유무와 상관없이 월 제목과 달력을 같은 위치에 둔다. */
export function SocialDateHeader({
  monthLabel,
  onToday,
  expanded,
  onExpanded,
  children,
}: CalendarViewProps & { monthLabel: string; onToday(): void; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View testID="today-top" style={s.row}>
      <Pressable
        style={s.month}
        accessibilityRole="button"
        accessibilityLabel={t('calendar.monthToday', { month: monthLabel })}
        onPress={onToday}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit style={[s.heading, { color: colors.ink }]}>
          {monthLabel}
        </Text>
      </Pressable>
      <CalendarViewSwitch expanded={expanded} onExpanded={onExpanded} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    minHeight: m.space.page,
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.xs,
    paddingHorizontal: m.space.lg,
  },
  month: { flex: 1, minHeight: m.height.touch, justifyContent: 'center' },
  heading: {
    fontFamily: m.fontExtraBold,
    fontWeight: '800',
    fontSize: m.type.month,
    letterSpacing: -0.6,
  },
  segment: { flexDirection: 'row', borderRadius: m.radius.pill },
  option: {
    minWidth: m.height.touch,
    minHeight: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: m.radius.pill,
  },
  letter: {
    minWidth: m.height.segmentMark,
    minHeight: m.height.segmentMark,
    lineHeight: m.height.segmentMark,
    borderRadius: m.radius.pill,
    textAlign: 'center',
    fontFamily: m.fontExtraBold,
    fontSize: m.type.button,
  },
});
