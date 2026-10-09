import { describe, expect, it } from 'vitest';
import { t } from './translate';

describe('t', () => {
  it('카탈로그 문구의 자리표시자를 바꾼다', () => {
    expect(t('mobile.spike.version', { version: '1.2.3' })).toBe('버전 1.2.3');
  });

  it('값이 없는 자리표시자는 번역 누락을 찾을 수 있게 남긴다', () => {
    expect(t('mobile.spike.version')).toBe('버전 {version}');
  });
});
