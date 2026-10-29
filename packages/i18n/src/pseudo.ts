// 쌍을 같은 위치로 매핑해 원문 대소문자를 보존한다.
const plain = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const accented = 'áƀçďéƒğħíĵķľḿñóṕɋŕšţúṽẃẋýžÁɃÇĎÉƑĞĦÍĴĶĽḾÑÓṔɊŔŠŢÚṼẂẊÝŽ';

/** SET-06: 자리표시자와 사용자 데이터는 그대로 두고 번역의 길이 여유만 점검한다. */
export function pseudoLocalize(message: string): string {
  let letters = 0;
  const transformed = message
    .split(/(\{[^}]+\})/g)
    .map((part) => {
      if (part.startsWith('{') && part.endsWith('}')) return part;
      return part.replace(/[a-z]/gi, (letter) => {
        letters += 1;
        return accented[plain.indexOf(letter)]!;
      });
    })
    .join('');
  return `[${transformed}${'~'.repeat(Math.ceil(letters * 0.4))}]`;
}

let enabled = false;

/** 개발 앱만 명시적으로 켜며 공유 패키지는 플랫폼 환경 변수를 읽지 않는다. */
export function setPseudoLocale(value: boolean): void {
  enabled = value;
}

/** 한국어와 사용자 데이터에는 pseudo 변환을 적용하지 않는다. */
export function isPseudoLocale(): boolean {
  return enabled;
}
