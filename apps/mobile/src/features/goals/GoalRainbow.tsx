import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { hsvToHex } from '@nodii/core';

const sectors = Array.from({ length: 72 }, (_, i) => {
  const angle = (i * Math.PI) / 36;
  const end = ((i + 1.15) * Math.PI) / 36;
  const point = (theta: number) => `${50 + 50 * Math.sin(theta)} ${50 - 50 * Math.cos(theta)}`;
  return {
    color: hsvToHex({ h: i * 5, s: 1, v: 1 }),
    path: `M50 50L${point(angle)}A50 50 0 0 1 ${point(end)}Z`,
  };
});

/** SOC-27: 무지개 원을 기존 SVG 렌더러에서 그린다. */
export function GoalRainbow() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        {sectors.map(({ color, path }) => (
          <Path key={color} d={path} fill={color} />
        ))}
      </Svg>
    </View>
  );
}
