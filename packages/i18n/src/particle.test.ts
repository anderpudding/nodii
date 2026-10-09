import { describe, expect, it } from 'vitest';
import { withParticle } from './particle';

describe('withParticle', () => {
  it('받침이 없으면 를과 가를 붙인다', () => {
    expect(withParticle('OS 과제', '을/를')).toBe('OS 과제를');
    expect(withParticle('장보기', '을/를')).toBe('장보기를');
    expect(withParticle('루틴', '이/가')).toBe('루틴이');
  });

  it('받침이 있으면 을과 이를 붙인다', () => {
    expect(withParticle('할 일', '을/를')).toBe('할 일을');
    expect(withParticle('목표', '이/가')).toBe('목표가');
  });

  it('빈 문자열과 비한글 끝 글자는 받침 없음으로 다룬다', () => {
    expect(withParticle('', '을/를')).toBe('를');
    expect(withParticle('Nodii', '이/가')).toBe('Nodii가');
  });
});
