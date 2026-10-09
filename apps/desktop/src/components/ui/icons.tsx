import type { ReactNode, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

/** 관리 메뉴에서 목표를 빠르게 구분하는 깃발 아이콘이다. */
export function GoalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 21V4m0 1h10.5l-2 3 2 3H6" />
    </Icon>
  );
}

/** 반복 규칙을 나타내는 단일 선 아이콘이다. */
export function RoutineIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 7h-4V3m4 4-3.2-3.2A8 8 0 1 0 20 16m0 1v4m0-4h-4" />
    </Icon>
  );
}

/** 텍스트 없이도 설정 진입점을 식별할 수 있는 조절 아이콘이다. */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6" />
    </Icon>
  );
}
