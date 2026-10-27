import { SPROUT_BODY, SPROUT_LEAVES } from '@nodii/core';

/** 체크와 같은 실루엣으로 로그인과 업데이트의 브랜드 표시를 맞춘다. */
export function BrandMark() {
  return (
    <svg className="brand-marks" viewBox="0 0 104 24" aria-hidden="true">
      {['#9B5CFF', '#FF3D8B', '#4F7CFF'].map((color, i) => (
        <g key={color} transform={`translate(${i * 26} 0)`} fill={color}>
          <path d={SPROUT_BODY} />
          <path d={SPROUT_LEAVES} />
        </g>
      ))}
      <path d={SPROUT_BODY} transform="translate(78 0)" fill="var(--color-chip)" />
    </svg>
  );
}
