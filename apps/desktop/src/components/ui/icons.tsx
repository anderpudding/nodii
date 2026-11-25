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

/** 프로필 도구의 톱니를 오늘 날짜 줄의 슬라이더와 구분한다. */
export function GearIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" {...props}>
      <path d="m10 3-.6 2.5-1.3.7-2.5-.7-2 3.5 1.8 1.8v1.6l-1.8 1.8 2 3.5 2.5-.7 1.3.7.6 2.5h4l.6-2.5 1.3-.7 2.5.7 2-3.5-1.8-1.8v-1.6l1.8-1.8-2-3.5-2.5.7-1.3-.7L14 3z" />
      <circle cx="12" cy="11.5" r="3" />
    </Icon>
  );
}

/** 달 이동은 글꼴 대신 같은 24단위 셰브론 형태를 쓴다. */
export function CalendarChevron({ previous = false }: { previous?: boolean }) {
  return (
    <Icon
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={previous ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
    </Icon>
  );
}
