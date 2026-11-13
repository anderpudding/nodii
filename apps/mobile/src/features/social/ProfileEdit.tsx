import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { avatarUrl, type NodiiClient } from '@nodii/api';
import { AVATAR_MAX_BYTES, checkAvatarSource, type SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Avatar, ProfileNav, SocialIcon, profileStyles as s } from './Primitives';
import { AvatarCrop, type CropSource } from './AvatarCrop';
import { cooldownDays, profileFields, type ProfileField } from './ProfileForms';

async function getSource(asset: ImagePicker.ImagePickerAsset): Promise<CropSource> {
  const file = new File(asset.uri);
  const size = file.size;
  if (
    size > AVATAR_MAX_BYTES ||
    (asset.fileSize ?? 0) > AVATAR_MAX_BYTES ||
    !checkAvatarSource(await file.bytes(), size)
  )
    throw new Error('invalid_photo');
  const { width, height } = await Image.getSize(asset.uri);
  if (!width || !height) throw new Error('photo_decode_failed');
  return { uri: asset.uri, width, height };
}

function discard(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('Temporary photo cleanup failed', error);
  }
}

/** SOC-01·04: 항목별 편집과 사진 보관함을 프로필 편집에서 연다. */
export function ProfileEdit({
  client,
  profile,
  onBack,
  onField,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  onBack(): void;
  onField(field: ProfileField): void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const choosing = useRef(false);
  const [source, setSource] = useState<CropSource | null>();
  const days = cooldownDays(profile);
  useEffect(
    () => () => {
      if (source) discard(source.uri);
    },
    [source],
  );
  async function choose() {
    if (choosing.current) return;
    choosing.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        exif: false,
        quality: 1,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        try {
          setSource(await getSource(asset));
        } catch (error) {
          discard(asset.uri);
          throw error;
        }
      }
    } catch {
      toast(() => t('social.photo.invalid'));
    } finally {
      choosing.current = false;
    }
  }
  return (
    <>
      <ProfileNav back={`‹ ${t('tabs.profile')}`} onBack={onBack} title={t('social.edit')} />
      <ScrollView
        contentContainerStyle={[
          s.page,
          { gap: m.space.lg, paddingTop: m.space.lg, paddingBottom: m.space.lg },
        ]}
      >
        {profile.autoHiddenAt && (
          <Text accessibilityRole="alert" style={[s.support, { color: colors.ink2 }]}>
            {t('social.profile.hidden')}
          </Text>
        )}
        <View style={{ alignItems: 'center', gap: m.space.sm, marginBottom: m.space.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('social.photo.change')}
            onPress={() => void choose()}
          >
            <Avatar
              size={84}
              label={profile.nickname}
              photoUrl={profile.avatarPath ? avatarUrl(client, profile.avatarPath, 480) : undefined}
            />
            <View
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 36,
                height: 36,
                borderWidth: 2,
                borderColor: colors.bg,
                borderRadius: m.radius.pill,
                backgroundColor: colors.ink,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SocialIcon name="camera" color={colors.bg} size={16} />
            </View>
          </Pressable>
          <Button quiet label={t('social.photo.change')} onPress={() => void choose()} />
          {profile.avatarPath && (
            <Button
              quiet
              secondary
              label={t('social.photo.reset')}
              onPress={() => setSource(null)}
            />
          )}
        </View>
        <View style={[s.card, { backgroundColor: colors.chip }]}>
          {profileFields.map((field, index) => (
            <Pressable
              key={field}
              accessibilityRole="button"
              accessibilityLabel={t(`social.${field}`)}
              onPress={() => onField(field)}
              style={({ pressed }) => [
                s.row,
                {
                  padding: m.space.lg,
                  minHeight: m.height.menu,
                  borderTopWidth: index ? m.todayRing : 0,
                  borderTopColor: colors.bg,
                  opacity: pressed ? m.pressedOpacity : 1,
                },
              ]}
            >
              <Text style={[s.body, { color: colors.ink }]}>{t(`social.${field}`)}</Text>
              <Text
                numberOfLines={1}
                style={[s.body, { flex: 1, textAlign: 'right', color: colors.muted }]}
              >
                {field === 'handle'
                  ? t('social.handle.display', { handle: profile.handle })
                  : profile[field]}
              </Text>
              {field === 'handle' && days ? (
                <>
                  <SocialIcon name="lock" size={16} color={colors.muted} />
                  <Text style={[s.support, { color: colors.muted }]}>
                    {t('social.handle.days', { days })}
                  </Text>
                </>
              ) : (
                <Text style={[s.body, { color: colors.muted }]}>›</Text>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {source !== undefined && (
        <AvatarCrop
          client={client}
          userId={profile.userId}
          source={source}
          hasPhoto={!!profile.avatarPath}
          onClose={() => setSource(undefined)}
        />
      )}
    </>
  );
}
