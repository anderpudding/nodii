import Svg, { G, Path } from 'react-native-svg';
import { SPROUT_BODY, SPROUT_LEAVES } from '@nodii/core';
import { useTheme } from '../../lib/theme';

/** 로그인도 체크와 같은 실루엣을 사용해 같은 앱임을 보여 준다. */
export function BrandMark() {
  const { colors } = useTheme();
  return (
    <Svg width={104} height={24} viewBox="0 0 104 24" accessible={false}>
      {['#9B5CFF', '#FF3D8B', '#4F7CFF'].map((color, i) => (
        <G key={color} transform={`translate(${i * 26} 0)`} fill={color}>
          <Path d={SPROUT_BODY} />
          <Path d={SPROUT_LEAVES} />
        </G>
      ))}
      <Path d={SPROUT_BODY} transform="translate(78 0)" fill={colors.chip} />
    </Svg>
  );
}
