import { useId } from 'react';
import {
  SPROUT_BODY,
  SPROUT_LEAVES,
  SPROUT_CHECK,
  SPROUT_NUMBER,
  stampFill,
  type DaySummary,
} from '@nodii/core';

/** 날짜 집계와 같은 월 캐시에서 받은 완료 목표 색을 그린다 (CAL-02)。 */
export function CalendarStamp({
  summary,
  future,
  today,
  colors = [],
}: {
  summary?: DaySummary;
  future: boolean;
  today: boolean;
  colors?: string[];
}) {
  const id = useId();
  const complete = !!summary?.total && summary.remaining === 0;
  const state = complete
    ? 'complete'
    : summary?.remaining
      ? future
        ? 'future'
        : 'remaining'
      : 'empty';
  const shape = SPROUT_BODY + (complete ? SPROUT_LEAVES : '');
  return (
    <span aria-hidden="true" className={`calendar-stamp stamp-${state}`}>
      <span
        className="stamp-fill"
        style={{
          background:
            complete && colors.length
              ? stampFill(colors)
              : `var(--color-${complete ? 'ink' : state === 'remaining' ? 'box' : 'stamp-soft'})`,
          clipPath: `url(#${id})`,
        }}
      />
      <svg viewBox="0 0 24 24">
        <defs>
          <clipPath id={id} clipPathUnits="userSpaceOnUse">
            <path d={shape} transform="scale(1.25)" />
          </clipPath>
        </defs>
        {!complete && <path d={SPROUT_BODY} className="stamp-outline" />}
        {complete ? (
          <path d={SPROUT_CHECK} className="stamp-check" />
        ) : (
          !!summary?.remaining && (
            <text
              {...SPROUT_NUMBER}
              textAnchor="middle"
              fill={`var(--color-${future ? 'muted' : today ? 'ink' : 'ink-2'})`}
            >
              {summary.remaining}
            </text>
          )
        )}
      </svg>
    </span>
  );
}
