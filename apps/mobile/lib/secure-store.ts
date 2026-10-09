import * as SecureStore from 'expo-secure-store';
import type { AuthStorage } from '@nodii/api';

/** NFR-07: iOS 인증 세션을 앱의 Keychain 영역에 보관한다. */
export const secureStoreAuthStorage: AuthStorage = {
  getItem(key) {
    return SecureStore.getItemAsync(key);
  },
  setItem(key, value) {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem(key) {
    return SecureStore.deleteItemAsync(key);
  },
};
