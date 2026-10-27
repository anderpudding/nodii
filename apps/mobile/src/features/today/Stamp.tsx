import { useId } from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  Text,
  Filter,
  FeDropShadow,
} from 'react-native-svg';
import {
  SPROUT_BODY,
  SPROUT_LEAVES,
  SPROUT_CHECK,
  SPROUT_NUMBER,
  type DaySummary,
} from '@nodii/core';
import { metrics as m, useHighContrast, useTheme } from '../../../lib/theme';

/** 완료한 목표 색은 하드 스톱으로 나누고 빈 날도 같은 씨앗 자리를 유지한다 (CAL-02). */
export function Stamp({
  summary,
  future,
  today,
  goalColors = [],
  showCount = true,
}: {
  summary?: DaySummary;
  future: boolean;
  today: boolean;
  goalColors?: string[];
  showCount?: boolean;
}) {
  const { colors } = useTheme();
  const highContrast = useHighContrast();
  const id = useId().replace(/:/g, '');
  const done = !!summary?.total && summary.remaining === 0;
  const palette = [...new Set(goalColors)].slice(0, 4);
  const fill = done
    ? palette.length > 1
      ? `url(#${id}-fill)`
      : (palette[0] ?? colors.ink)
    : future || !summary?.total
      ? colors.stampSoft
      : colors.box;
  return (
    <Svg width={m.glyph.stamp} height={m.glyph.stamp} viewBox="0 0 24 24" accessible={false}>
      <Defs>
        {done && palette.length > 1 && (
          <LinearGradient id={`${id}-fill`} x1="0%" y1="0%" x2="100%" y2="100%">
            {palette.flatMap((color, i) => [
              <Stop key={`${i}-start`} offset={i / palette.length} stopColor={color} />,
              <Stop key={`${i}-end`} offset={(i + 1) / palette.length} stopColor={color} />,
            ])}
          </LinearGradient>
        )}
        {done && (
          <Filter id={`${id}-shadow`}>
            <FeDropShadow
              dx={0}
              dy={0.8}
              stdDeviation={0.8}
              floodColor="#111318"
              floodOpacity={0.36}
            />
          </Filter>
        )}
      </Defs>
      <Path
        testID="stamp-body"
        d={SPROUT_BODY + (done ? SPROUT_LEAVES : '')}
        fill={fill}
        stroke={!done && highContrast ? colors.muted : 'none'}
        strokeWidth={1.4}
      />
      {done ? (
        <Path
          testID="stamp-check"
          d={SPROUT_CHECK}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${id}-shadow)`}
        />
      ) : (
        showCount &&
        !!summary?.remaining && (
          <Text
            testID="stamp-count"
            {...SPROUT_NUMBER}
            fontFamily={m.fontExtraBold}
            textAnchor="middle"
            fill={future ? colors.muted : today ? colors.ink : colors.ink2}
          >
            {summary.remaining}
          </Text>
        )
      )}
    </Svg>
  );
}
