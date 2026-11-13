import { AVATAR_SIZES, type AvatarSize } from '@nodii/core';
import type { NodiiClient } from './client';
import { fetchMySocialProfile, updateSocialProfile } from './repositories/social-profiles';

export type AvatarBytes = Record<AvatarSize, ArrayBuffer>;
const filename = (path: string, size: AvatarSize) => `${path}_${size}.jpg`;

/** SOC-04: 고유 주소로 교체하므로 이전 사진 캐시를 재사용하지 않는다. */
export function avatarUrl(client: NodiiClient, path: string, size: AvatarSize): string {
  return client.storage.from('avatars').getPublicUrl(filename(path, size)).data.publicUrl;
}

async function deleteFiles(client: NodiiClient, files: string[]) {
  if (!files.length) return;
  const { error } = await client.storage.from('avatars').remove(files);
  if (error) throw error;
}

async function cleanPrevious(client: NodiiClient, userId: string, path: string | null) {
  if (!path?.startsWith(`${userId}/`)) return;
  try {
    await deleteFiles(
      client,
      AVATAR_SIZES.map((size) => filename(path, size)),
    );
  } catch (error) {
    // 프로필은 이미 저장됐다. 성공을 롤백하거나 새 사진을 지우면 안 된다.
    console.warn('Avatar replacement cleanup failed', error);
  }
}

/** SOC-04: 두 파일이 올라간 뒤에만 프로필을 교체하고 실패한 배치를 정리한다. */
export async function uploadAvatar(
  client: NodiiClient,
  userId: string,
  bytes: AvatarBytes,
  uuid: string,
) {
  const previous = await fetchMySocialProfile(client, userId);
  if (!previous) throw new Error('missing_social_profile');
  const path = `${userId}/${uuid}`;
  const files: string[] = [];
  let next;
  try {
    for (const size of AVATAR_SIZES) {
      const key = filename(path, size);
      files.push(key);
      const { error } = await client.storage
        .from('avatars')
        .upload(key, bytes[size], { contentType: 'image/jpeg' });
      if (error) throw error;
    }
    next = await updateSocialProfile(client, userId, { avatarPath: path });
  } catch (error) {
    try {
      await deleteFiles(client, files);
    } catch (cleanup) {
      console.warn('Incomplete avatar cleanup failed', cleanup);
    }
    throw error;
  }
  await cleanPrevious(client, userId, previous.avatarPath);
  return next;
}

/** SOC-04: 기본 이미지 전환을 먼저 저장한 뒤 사용하지 않는 파일을 지운다. */
export async function removeAvatar(client: NodiiClient, userId: string) {
  const previous = await fetchMySocialProfile(client, userId);
  const next = await updateSocialProfile(client, userId, { avatarPath: null });
  await cleanPrevious(client, userId, previous?.avatarPath ?? null);
  return next;
}

/** SOC-70: 인증이 사라지기 전에 내 폴더의 사진을 페이지 단위로 비운다. */
export async function clearMyAvatarFolder(client: NodiiClient, userId: string) {
  const limit = 100;
  const pending = [''];
  for (const folder of pending) {
    const files: string[] = [];
    for (let offset = 0; ; offset += limit) {
      const { data, error } = await client.storage.from('avatars').list(`${userId}${folder}`, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      for (const entry of data) {
        const name = `${folder}/${entry.name}`;
        if (entry.id === null) pending.push(name);
        else files.push(`${userId}${name}`);
      }
      if (data.length < limit) break;
    }
    for (let offset = 0; offset < files.length; offset += limit)
      await deleteFiles(client, files.slice(offset, offset + limit));
  }
}
