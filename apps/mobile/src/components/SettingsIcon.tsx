import Svg, { Circle, Path } from 'react-native-svg';
import { metrics as m } from '../../lib/theme';

/** 설정 진입점을 시안과 같은 조절 아이콘으로 표시한다 (MOB-04). */
export function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg
      width={m.glyph.icon}
      height={m.glyph.icon}
      viewBox="0 0 24 24"
      accessible={false}
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
      <Circle cx={15} cy={7} r={2} />
      <Circle cx={9} cy={17} r={2} />
    </Svg>
  );
}
