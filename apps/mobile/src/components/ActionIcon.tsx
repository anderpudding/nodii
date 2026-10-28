import Svg, { Path } from 'react-native-svg';
import { metrics as m } from '../../lib/theme';

const paths: Record<string, string> = {
  toggle: 'M5 12l4 4L19 6',
  rename: 'M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L5 15z',
  move: 'M7 3v4m10-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  delete: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6',
  skip: 'M6 12h12',
  stop: 'M6 12h12',
  archive: 'M4 4h16v4H4zM6 8v12h12V8M10 12h4',
  import: 'M12 3v12m-4-4l4 4 4-4M4 16v5h16v-5',
};

/** 메뉴와 밀기 칸이 같은 20pt 선 아이콘으로 동작을 설명한다 (MOB-01). */
export function ActionIcon({ action, color }: { action: string; color: string }) {
  const path = paths[action];
  if (!path) return null;
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
      <Path d={path} />
    </Svg>
  );
}
