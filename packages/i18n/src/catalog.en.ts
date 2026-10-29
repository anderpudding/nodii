import type { MessageKey } from './catalog.ko';
import type { PluralKey } from './translate';

export const en: Partial<Record<MessageKey | PluralKey, string>> = {
  'settings.language': 'Language',
  'settings.language.system': 'System',
  'settings.language.ko': '한국어',
  'settings.language.en': 'English',
  'settings.language.loadFailed': "Couldn't load your language setting",
  'settings.language.saveFailed': "Couldn't save your language",
};
