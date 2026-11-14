import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import {
  registerPushToken,
  removePushToken,
  type DevicePushToken,
  type NodiiClient,
} from '@nodii/api';

const tokenKey = 'nodii:registered-push-token';
let pending: Promise<unknown> = Promise.resolve();
const sessionChanges = new WeakSet<NodiiClient>();

function serialized<T>(work: () => Promise<T>) {
  const result = pending.then(work);
  pending = result.catch(() => {});
  return result;
}

export const foregroundPresentation = {
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
} as const;

/** SOC-54: 권한을 요청하지 않고, 기기의 현재 설정이 바뀐 경우만 등록한다. */
export function syncPushToken(client: NodiiClient, userId: string, active: () => boolean) {
  return serialized(async () => {
    if (!active() || sessionChanges.has(client)) return;
    const permission = await Notifications.getPermissionsAsync();
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!permission.granted || typeof projectId !== 'string') return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!active() || sessionChanges.has(client)) return;
    const record: DevicePushToken = {
      token,
      userId,
      locale: getLocales()[0]?.languageTag.toLowerCase().startsWith('ko') ? 'ko' : 'en',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      version: Constants.expoConfig?.version ?? '',
    };
    const next = JSON.stringify(record);
    const last = await AsyncStorage.getItem(tokenKey);
    if (last === next || !active() || sessionChanges.has(client)) return;
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session?.user.id !== userId || !active() || sessionChanges.has(client)) return;
    tokenWrite = registerPushToken(client, record).then(() => AsyncStorage.setItem(tokenKey, next));
    try {
      await tokenWrite;
    } finally {
      tokenWrite = null;
    }
  });
}

/** SOC-54: 계정을 바꾸는 동안 등록을 멈추고 현재 토큰 해제를 먼저 시도한다. */
export async function withPushTokenCleanup<T>(
  client: NodiiClient,
  userId: string,
  onCleanupError: () => void,
  work: () => Promise<T>,
) {
  sessionChanges.add(client);
  try {
    // 토큰 발급 네트워크 요청이 진행 중이어도 계정 작업을 지연시키지 않는다.
    // 진행 중인 등록 RPC가 있다면 그 등록과 마지막 기기 저장까지만 기다린다.
    await tokenWrite?.catch(() => {});
    try {
      const stored = await AsyncStorage.getItem(tokenKey);
      if (stored) {
        const record = JSON.parse(stored) as Partial<DevicePushToken>;
        if (record.userId === userId && typeof record.token === 'string') {
          await AsyncStorage.removeItem(tokenKey);
          await removePushToken(client, userId, record.token);
        }
      }
    } catch {
      onCleanupError();
    }
    return await work();
  } finally {
    sessionChanges.delete(client);
  }
}

let tokenWrite: Promise<void> | null = null;
