// Edge 배포는 앱 번들과 분리되어 있어 카탈로그 사본을 두고 테스트로 대조한다.
const copy = {
  ko: {
    "social.notifications.sentenceFollow": "{name}님이 나를 팔로우했어요",
    "social.notifications.sentenceReactionPush": "{name}님이 좋아요를 남겼어요",
    "social.notifications.sentenceFriendDone":
      "{name}님이 할 일 {count}개를 끝냈어요",
    "social.notifications.sentenceFriendDone_one":
      "{name}님이 할 일 {count}개를 끝냈어요",
  },
  en: {
    "social.notifications.sentenceFollow": "{name} followed you",
    "social.notifications.sentenceReactionPush": "{name} left a like",
    "social.notifications.sentenceFriendDone": "{name} completed {count} tasks",
    "social.notifications.sentenceFriendDone_one":
      "{name} completed {count} task",
  },
};

export type Kind = "follow" | "friend_done" | "reaction";
export const throttleMs = 3 * 60 * 60 * 1000;

/** SOC-51: 사용할 수 없는 시간대는 발송을 건너뛴다. */
export function daytime(now: Date, timeZone: string) {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
      }).format(now),
    );
    return hour >= 8 && hour < 23;
  } catch {
    return false;
  }
}

/** SOC-54: 잠금 화면에 항목 제목을 노출하지 않는다. */
export function pushBody(
  kind: Kind,
  locale: string,
  name: string,
  count: number,
) {
  const catalog = locale === "en" ? copy.en : copy.ko;
  const key = kind === "follow"
    ? "social.notifications.sentenceFollow"
    : kind === "reaction"
    ? "social.notifications.sentenceReactionPush"
    : count === 1
    ? "social.notifications.sentenceFriendDone_one"
    : "social.notifications.sentenceFriendDone";
  return catalog[key].replace(
    /\{(name|count)\}/g,
    (_, part: string) => part === "name" ? name : String(count),
  );
}
