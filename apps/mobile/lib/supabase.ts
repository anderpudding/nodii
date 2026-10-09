import { createNodiiClient } from '@nodii/api';
import { secureStoreAuthStorage } from './secure-store';

export const mobileEnv = {
  reviewAccountEmail: process.env.EXPO_PUBLIC_REVIEW_ACCOUNT_EMAIL ?? '',
  appStoreId: process.env.EXPO_PUBLIC_APP_STORE_ID ?? '',
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// 빌드 설정이 빠졌을 때 게이트가 연결 설정 안내를 표시한다.
export const mobileClient =
  url && publishableKey
    ? createNodiiClient({ url, publishableKey, storage: secureStoreAuthStorage })
    : null;
