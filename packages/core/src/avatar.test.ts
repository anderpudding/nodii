import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkAvatarSource, cropRect, stripJpegMetadata } from './avatar';

const jpg = Uint8Array.of(255, 216, 255);
const segment = (marker: number) => [255, marker, 0, 4, 42, 24];
describe('S2 photo rules', () => {
  it('accepts the original formats and rejects GIF, animation, spoofed or oversized data', () => {
    expect(checkAvatarSource(jpg, 10_000_000)).toBe(true);
    expect(checkAvatarSource(jpg, 10_000_001)).toBe(false);
    expect(checkAvatarSource(jpg, 0)).toBe(false);
    expect(checkAvatarSource(new TextEncoder().encode('GIF89a'), 200)).toBe(false);
    expect(checkAvatarSource(new TextEncoder().encode('0000ftypheic'), 200)).toBe(true);
    const png = [137, 80, 78, 71, 13, 10, 26, 10];
    expect(
      checkAvatarSource(Uint8Array.of(...png, 0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0), 20),
    ).toBe(true);
    expect(
      checkAvatarSource(Uint8Array.of(...png, 0, 0, 0, 0, 97, 99, 84, 76, 0, 0, 0, 0), 20),
    ).toBe(false);
  });
  it('removes metadata without modifying color or scan data, including stuffed markers', () => {
    const scan = [255, 218, 0, 4, 1, 2, 255, 0, 225, 255, 208, 42];
    const before = Uint8Array.of(
      255,
      216,
      ...segment(224),
      ...segment(225),
      ...segment(226),
      ...segment(237),
      ...scan,
      ...segment(254),
      255,
      217,
    );
    expect(stripJpegMetadata(before)).toEqual(
      Uint8Array.of(255, 216, ...segment(224), ...segment(226), ...scan, 255, 217),
    );
    expect(() => stripJpegMetadata(Uint8Array.of(0))).toThrow();
    expect(() => stripJpegMetadata(Uint8Array.of(255, 216, 255, 225, 0, 20))).toThrow();
  });
  it('strips the EXIF left by the S0 iOS encoder from a real JPEG', () => {
    const original = readFileSync(new URL('./fixtures/s0-avatar.jpg', import.meta.url));
    expect(original.includes('Exif\0\0')).toBe(true);
    const clean = stripJpegMetadata(original);
    expect(Buffer.from(clean).includes('Exif\0\0')).toBe(false);
    expect(stripJpegMetadata(clean)).toEqual(clean);
  });
  it('computes a centered square and clamps a zoomed crop to the source', () => {
    expect(cropRect({ width: 800, height: 400 }, 310, 1, { x: 0, y: 0 })).toEqual({
      originX: 200,
      originY: 0,
      width: 400,
      height: 400,
    });
    expect(cropRect({ width: 400, height: 800 }, 310, 2, { x: -1000, y: 1000 })).toEqual({
      originX: 200,
      originY: 0,
      width: 200,
      height: 200,
    });
  });
});
