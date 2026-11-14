import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { goalInk, goalVisibilityPaths, type GoalVisibility } from '@nodii/core';
import { useTheme } from '../../../lib/theme';

/** SOC-24: 같은 점과 공개 범위 아이콘을 모든 목표 이름표에서 그린다. */
export function GoalMark({
  color,
  visibility,
  size = 10,
  friend = false,
  onChip = false,
  selected = false,
}: {
  color: string;
  visibility?: GoalVisibility;
  size?: number;
  friend?: boolean;
  onChip?: boolean;
  selected?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const icon =
    !friend && (visibility === 'mutual' || visibility === 'followers') ? visibility : null;
  if (!icon)
    return (
      <View
        testID="goal-mark-dot"
        accessible={false}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      />
    );
  const width = size * (icon === 'mutual' ? 1.7 : 1.6);
  return (
    <Svg
      testID={`goal-mark-${icon}`}
      accessible={false}
      viewBox="0 0 24 24"
      width={width}
      height={width}
    >
      <Path
        d={goalVisibilityPaths[icon]}
        fill={selected ? colors.bg : goalInk(color, onChip ? colors.bg : colors.chip, isDark)}
      />
    </Svg>
  );
}
