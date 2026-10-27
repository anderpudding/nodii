import { SPROUT_BODY, SPROUT_LEAVES, SPROUT_CHECK, SPROUT_DASH } from '@nodii/core';

/** 같은 씨앗 실루엣으로 완료·건너뜀을 색 이외의 모양으로 구분한다 (TODO-02, ROUT-07). */
export function SproutCheck({
  done = false,
  skipped = false,
}: {
  done?: boolean;
  skipped?: boolean;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sprout-check">
      <path d={SPROUT_BODY} className={done ? 'sprout-filled' : 'sprout-empty'} />
      {done && <path d={SPROUT_LEAVES} className="sprout-filled sprout-pop" />}
      {done && <path d={SPROUT_CHECK} className="sprout-mark sprout-pop" />}
      {!done && skipped && <path d={SPROUT_DASH} className="sprout-dash" />}
    </svg>
  );
}
