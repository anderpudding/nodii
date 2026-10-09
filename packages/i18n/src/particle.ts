export type KoreanParticlePair = '을/를' | '이/가';

function hasFinalConsonant(value: string): boolean {
  const last = Array.from(value.trim()).at(-1);
  if (!last) return false;

  const code = last.codePointAt(0);
  if (code === undefined || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** SET-06: 받침 여부에 맞는 조사를 붙여 화면마다 같은 규칙을 다시 만들지 않게 한다. */
export function withParticle(value: string, pair: KoreanParticlePair): string {
  const hasBatchim = hasFinalConsonant(value);
  const particle = pair === '을/를' ? (hasBatchim ? '을' : '를') : hasBatchim ? '이' : '가';
  return `${value}${particle}`;
}
