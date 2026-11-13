import { describe, expect, it } from 'vitest';
import {
  validateHandle,
  validateNickname,
  validateBio,
  handleChangeAvailableAt,
  inviteUrl,
  parseInviteUrl,
  followButtonState,
  normalizeSearchQuery,
  validateReportDetail,
  visibleProfile,
} from './social';

describe('S2 profile rules', () => {
  it('normalizes an ID and distinguishes each syntax error', () => {
    expect(validateHandle('Read_1.me')).toEqual({ value: 'read_1.me', status: 'ok' });
    for (const [raw, reason] of [
      ['ab', 'length'],
      ['1abc', 'start'],
      ['ab-c', 'characters'],
      ['ab..c', 'dots'],
      ['abc.', 'trailingDot'],
    ] as const) {
      expect(validateHandle(raw)).toEqual({ value: raw, status: 'invalid', reason });
    }
  });
  it('uses Unicode character counts, normalizes line endings, and rejects a third line', () => {
    expect(validateNickname('  🌱  ')).toEqual({ value: '🌱', count: 1, valid: true });
    expect(validateNickname('  ').valid).toBe(false);
    expect(validateNickname('🌱'.repeat(21)).valid).toBe(false);
    expect(validateBio('a\r\nb')).toEqual({ value: 'a\nb', count: 3, valid: true });
    expect(validateBio('a\nb\nc').valid).toBe(false);
    expect(validateBio('a\rb').valid).toBe(false);
    expect(validateBio('x'.repeat(81)).valid).toBe(false);
    expect(validateBio('').valid).toBe(true);
  });
  it('ends cooldown at exactly 30 days', () => {
    const changed = '2026-03-01T12:00:00Z';
    const end = Date.parse('2026-03-31T12:00:00Z');
    expect(handleChangeAvailableAt(changed, end - 1)).toBe(end);
    expect(handleChangeAvailableAt(changed, end)).toBeNull();
    expect(handleChangeAvailableAt(null, end)).toBeNull();
  });
  it('recognizes only the Nodii invite path', () => {
    expect(parseInviteUrl(inviteUrl('ab_c-123'))).toBe('ab_c-123');
    expect(parseInviteUrl('https://nodii.app/u/abcd/?from=share#app')).toBe('abcd');
    for (const url of [
      'https://nodii.app.evil/u/abcd',
      'https://nodii.app/u/a/b',
      'http://nodii.app/u/abcd',
      'https://nodii.app/u/',
      'https://nodii.app/u/a%2Fb',
      null,
    ]) {
      expect(parseInviteUrl(url)).toBeNull();
    }
  });
});

describe('S3 social rules', () => {
  it.each([
    [false, false, 'follow'],
    [false, true, 'followBack'],
    [true, false, 'following'],
    [true, true, 'following'],
  ])('chooses the follow button for %s / %s', (iFollow, followsMe, expected) => {
    expect(followButtonState({ iFollow, followsMe })).toBe(expected);
  });

  it.each([
    [' @ReAd ', 'read'],
    [' @a ', null],
    ['@', null],
    ['🌱', null],
    ['가나', '가나'],
  ])('normalizes search input %s', (raw, expected) => {
    expect(normalizeSearchQuery(raw)).toBe(expected);
  });

  it('requires a nonblank detail for other and counts Unicode characters', () => {
    expect(validateReportDetail(' ', 'other').valid).toBe(false);
    expect(validateReportDetail(' ', 'spam').valid).toBe(true);
    expect(validateReportDetail(' 🌱 ', 'other')).toEqual({ value: '🌱', count: 1, valid: true });
    expect(validateReportDetail('🌱'.repeat(500), 'other').valid).toBe(true);
    expect(validateReportDetail('x'.repeat(501), 'spam').valid).toBe(false);
  });

  it('preserves the original profile and removes hidden fields for other viewers', () => {
    const profile = { autoHiddenAt: 'now', avatarPath: 'photo', bio: 'bio', nickname: 'Reader' };
    expect(visibleProfile(profile, true)).toBe(profile);
    expect(visibleProfile(profile, false)).toEqual({ ...profile, avatarPath: null, bio: null });
    const unhidden = { ...profile, autoHiddenAt: null };
    expect(visibleProfile(unhidden, false)).toBe(unhidden);
  });
});
