export const ko = {
  'common.retry': '다시 확인',
  'mobile.spike.eyebrow': 'NODII · M0',
  'mobile.spike.title': '연결 준비 확인',
  'mobile.spike.description': '공유 코드와 기기 기능이 잘 이어지는지 확인해요.',
  'mobile.spike.network.label': '외부 네트워크',
  'mobile.spike.storage.label': '보안 저장소',
  'mobile.spike.status.checking': '확인하고 있어요',
  'mobile.spike.status.success': '정상이에요',
  'mobile.spike.network.missingEnv': '환경 변수를 설정해 주세요',
  'mobile.spike.network.failed': '연결하지 못했어요 · 상태 {status}',
  'mobile.spike.storage.success': '2KB 쓰기와 읽기에 성공했어요',
  'mobile.spike.storage.failed': '저장하지 못했어요 · 다시 확인',
  'mobile.spike.previous.none': '이전 실행 기록이 없어요',
  'mobile.spike.previous.value': '이전 실행 · {value}',
  'mobile.spike.version': '버전 {version}',
  'mobile.spike.core': '공유 코드 · {date} · 반복 {occurs}',
  'mobile.spike.core.occurs': '표시',
  'mobile.spike.core.notOccurs': '숨김',
} as const;

export type MessageKey = keyof typeof ko;
