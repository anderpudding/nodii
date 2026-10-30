import { useLocale } from '../lib/use-locale';
import { AppGate } from '../src/shell/AppGate';

export default function IndexScreen() {
  useLocale();
  return <AppGate />;
}
