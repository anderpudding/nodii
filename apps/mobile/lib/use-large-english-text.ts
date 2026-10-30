import { useWindowDimensions } from 'react-native';
import { useLocale } from './use-locale';

/** SET-06: 한국어 배치는 보존하고 영어 확대 문구에만 세로 배치를 적용한다. */
export function useLargeEnglishText() {
  const { fontScale } = useWindowDimensions();
  return useLocale() === 'en' && fontScale > 1;
}
