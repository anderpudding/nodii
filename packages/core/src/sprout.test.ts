import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as sprout from './sprout';

const document = readFileSync(
  new URL('../../../docs/design/components.md', import.meta.url),
  'utf8',
);
describe('싹이 공통 실루엣 (CAL-02, ROUT-05)', () => {
  it.each(['SPROUT_BODY', 'SPROUT_LEAVES', 'SPROUT_CHECK', 'SPROUT_DASH'] as const)(
    '%s는 문서의 path와 정확히 같다',
    (name) => {
      const path = document
        .match(new RegExp(`${name}\\s*= ([^\\n]+)`))![1]!
        .split('   ')[0]!
        .trim();
      expect(sprout[name]).toBe(path);
    },
  );
  it('도장 숫자를 씨앗 중심에 놓는다', () => {
    expect(sprout.SPROUT_NUMBER).toEqual({ x: 12, y: 17.6, fontSize: 9.5, fontWeight: 800 });
  });
});
