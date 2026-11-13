export const AVATAR_MAX_BYTES = 10_000_000;
export const AVATAR_SIZES = [160, 480] as const;
export type AvatarSize = (typeof AVATAR_SIZES)[number];

interface Size {
  width: number;
  height: number;
}
interface Offset {
  x: number;
  y: number;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** SOC-04: 확장자가 아니라 파일 서명으로 검사하고 움직이는 사진은 받지 않는다. */
export function checkAvatarSource(bytes: Uint8Array, size: number): boolean {
  if (!Number.isFinite(size) || size <= 0 || size > AVATAR_MAX_BYTES) return false;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return true;
  if (/^ftyp(heic|heix|hevc|hevx|mif1)$/.test(ascii(bytes, 4, 12))) {
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const end = Math.min(header.getUint32(0), bytes.length);
    for (let index = 16; index + 4 <= end; index += 4)
      if (/^(msf1|heis|hevm|hevs|avis)$/.test(ascii(bytes, index, index + 4))) return false;
    return true;
  }
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte))
    return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 8; index + 12 <= bytes.length;) {
    const end = index + 12 + view.getUint32(index);
    if (end > bytes.length) return false;
    const type = ascii(bytes, index + 4, index + 8);
    if (type === 'acTL') return false;
    if (type === 'IEND') return true;
    index = end;
  }
  return false;
}

/** SOC-04: 틀을 이미지 안에 유지하면서 인코더와 미리보기가 같은 원본 좌표를 쓴다. */
export function cropRect(image: Size, viewport: number, zoom: number, offset: Offset) {
  const width = Math.max(
    1,
    Math.floor(Math.min(image.width, image.height) / Math.max(1, Math.min(4, zoom))),
  );
  const scale = viewport / width;
  const start = (size: number, delta: number) =>
    Math.min(size - width, Math.max(0, Math.round((size - width) / 2 - delta / scale)));
  return {
    originX: start(image.width, offset.x),
    originY: start(image.height, offset.y),
    width,
    height: width,
  };
}

/** SOC-04: 재인코더가 쓴 EXIF·XMP·IPTC·주석만 없애고 ICC와 픽셀은 보존한다. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const invalid = () => new Error('invalid_jpeg');
  if (bytes[0] !== 255 || bytes[1] !== 216) throw invalid();
  const output = new Uint8Array(bytes.length);
  output.set(bytes.subarray(0, 2));
  let length = 2;
  let cursor = 2;
  let scan = false;
  while (cursor < bytes.length) {
    const start = cursor;
    if (scan) {
      while (cursor < bytes.length) {
        if (bytes[cursor] !== 255) {
          cursor++;
          continue;
        }
        let next = cursor + 1;
        while (bytes[next] === 255) next++;
        const marker = bytes[next];
        if (marker !== 0 && !(marker !== undefined && marker >= 208 && marker <= 215)) break;
        cursor = next + 1;
      }
      output.set(bytes.subarray(start, cursor), length);
      length += cursor - start;
      scan = false;
      continue;
    }
    if (bytes[cursor++] !== 255) throw invalid();
    while (bytes[cursor] === 255) cursor++;
    const marker = bytes[cursor++];
    if (marker === 217) {
      output.set(bytes.subarray(start, cursor), length);
      return output.slice(0, length + cursor - start);
    }
    if (marker === 1) {
      output.set(bytes.subarray(start, cursor), length);
      length += cursor - start;
      continue;
    }
    if (marker === 0 || cursor + 2 > bytes.length) throw invalid();
    const size = new DataView(bytes.buffer, bytes.byteOffset + cursor, 2).getUint16(0);
    cursor += size;
    if (size < 2 || cursor > bytes.length) throw invalid();
    if (marker !== 225 && marker !== 237 && marker !== 254) {
      output.set(bytes.subarray(start, cursor), length);
      length += cursor - start;
    }
    scan = marker === 218;
  }
  throw invalid();
}
