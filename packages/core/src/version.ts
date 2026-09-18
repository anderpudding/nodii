const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** SET-05: 문자열 정렬로 0.10.0을 0.9.0보다 낮게 판단하지 않도록 한다. */
export function compareVersion(a: string, b: string): -1 | 0 | 1 {
  if (!VERSION.test(a) || !VERSION.test(b)) {
    throw new RangeError('버전은 major.minor.patch 형식이어야 합니다.');
  }
  const left = a.split('.').map(BigInt);
  const right = b.split('.').map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (left[i]! < right[i]!) return -1;
    if (left[i]! > right[i]!) return 1;
  }
  return 0;
}
