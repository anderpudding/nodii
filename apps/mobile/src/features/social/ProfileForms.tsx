import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  socialErrorCode,
  useCreateSocialProfile,
  useHandleAvailability,
  useProfileTextCheck,
  useUpdateSocialProfile,
  type NodiiClient,
} from '@nodii/api';
import {
  handleChangeAvailableAt,
  validateBio,
  validateHandle,
  validateNickname,
  type SocialProfile,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Avatar, ProfileNav, SocialIcon, profileStyles as s } from './Primitives';

export const profileFields = ['nickname', 'handle', 'bio'] as const;
export type ProfileField = (typeof profileFields)[number];

/** SOC-02: 쿨다운은 서버 시각에서 날짜 수를 계산한다. */
export function cooldownDays(profile: SocialProfile) {
  const now = Date.now();
  const end = handleChangeAvailableAt(profile.handleChangedAt, now);
  return end ? Math.ceil((end - now) / 86_400_000) : 0;
}

function Hint({ status }: { status: ReturnType<typeof useHandleAvailability> }) {
  const { colors } = useTheme();
  if (!status) return null;
  const neutral = status === 'checking' || status === 'offline';
  const color = neutral ? colors.muted : status === 'ok' ? colors.ink : colors.danger;
  return (
    <View style={s.row}>
      {status === 'checking' ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        !neutral && (
          <SocialIcon name={status === 'ok' ? 'check' : 'error'} size={16} color={color} />
        )
      )}
      <Text accessibilityLiveRegion="polite" style={[s.support, { color, flexShrink: 1 }]}>
        {t(`social.handle.${status}`)}
      </Text>
    </View>
  );
}

function Field({
  field,
  value,
  onChange,
  disabled,
  label = false,
}: {
  field: ProfileField;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  label?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: m.space.xs }}>
      {label && <Text style={[s.label, { color: colors.muted }]}>{t(`social.${field}`)}</Text>}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.chip,
          paddingHorizontal: m.space.lg,
          borderRadius: m.radius.field,
          minHeight: m.height.field,
          borderWidth: m.todayRing,
          borderColor: focused ? colors.ink : colors.chip,
        }}
      >
        {field === 'handle' && (
          <Text importantForAccessibility="no" style={[s.body, { color: colors.muted }]}>
            @
          </Text>
        )}
        <TextInput
          accessibilityLabel={t(`social.${field}`)}
          accessibilityState={{ disabled }}
          editable={!disabled}
          value={value}
          autoCapitalize={field === 'handle' ? 'none' : 'sentences'}
          autoCorrect={field !== 'handle'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={field === 'bio'}
          onChangeText={(text) => onChange(field === 'handle' ? text.toLowerCase() : text)}
          style={[
            s.body,
            {
              flex: 1,
              color: disabled ? colors.muted : colors.ink,
              minHeight: field === 'bio' ? m.height.field * 1.5 : m.height.field - 3,
              paddingVertical: m.space.sm,
            },
          ]}
        />
      </View>
    </View>
  );
}

/** SOC-03: 먼저 정하는 이름과 ID를 저장하기 전에 미리 보여준다. */
export function ProfileSetup({
  client,
  userId,
  bottom,
}: {
  client: NodiiClient;
  userId: string;
  bottom: number;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [nickname, setNickname] = useState('');
  const [handle, setHandle] = useState('');
  const [failure, setFailure] = useState<ReturnType<typeof socialErrorCode>>();
  const create = useCreateSocialProfile(client, userId);
  const name = validateNickname(nickname);
  const status = useHandleAvailability(client, handle);
  const moderation = useProfileTextCheck(client, name.value, true, name.valid);
  const hint =
    failure === 'taken'
      ? 'taken'
      : failure === 'handle_held' || failure === 'reserved'
        ? 'unavailable'
        : status;
  const valid =
    name.valid &&
    hint === 'ok' &&
    moderation !== 'banned' &&
    moderation !== 'reserved' &&
    failure !== 'banned' &&
    !create.isPending;
  function save() {
    if (!valid) return;
    create.mutate(
      { nickname: name.value, handle },
      {
        onError: (error) => {
          const code = socialErrorCode(error);
          setFailure(code);
          if (code === 'network' || code === 'unknown') toast(() => t('social.save.failed'));
        },
      },
    );
  }
  return (
    <KeyboardAvoidingView behavior="padding" style={s.fill}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.page,
          { paddingTop: m.space.page, paddingBottom: bottom + m.space.lg, gap: m.space.sm },
        ]}
      >
        <Text accessibilityRole="header" style={[s.title, { color: colors.ink }]}>
          {t('social.setup.title')}
        </Text>
        <Text style={[s.body, { color: colors.ink2 }]}>{t('social.setup.description')}</Text>
        <View
          style={[s.row, { gap: m.space.md, marginTop: m.space.page, marginBottom: m.space.lg }]}
        >
          <Avatar size={64} label={t('social.photo.preview')} />
          <View style={{ flexShrink: 1 }}>
            <Text style={[s.heading, { color: name.value ? colors.ink : colors.muted }]}>
              {name.value || t('social.nickname')}
            </Text>
            <Text style={[s.support, { color: colors.muted }]}>
              {t('social.handle.display', { handle: handle || t('social.handle') })}
            </Text>
          </View>
        </View>
        <Field
          field="nickname"
          value={nickname}
          label
          disabled={create.isPending}
          onChange={(text) => {
            setNickname(text);
            setFailure(undefined);
          }}
        />
        <Text style={[s.support, { color: colors.muted, textAlign: 'right' }]}>
          {t('social.count.remaining', { count: 20 - name.count })}
        </Text>
        {(moderation === 'banned' || failure === 'banned' || moderation === 'reserved') && (
          <Text accessibilityRole="alert" style={[s.support, { color: colors.danger }]}>
            {t(moderation === 'reserved' ? 'social.handle.unavailable' : 'social.text.banned')}
          </Text>
        )}
        <Field
          field="handle"
          value={handle}
          label
          disabled={create.isPending}
          onChange={(text) => {
            setHandle(text);
            setFailure(undefined);
          }}
        />
        <Hint status={hint} />
        <View style={{ flex: 1, minHeight: m.space.lg }} />
        <Button
          pill
          label={t('social.setup.start')}
          disabled={!valid}
          busy={create.isPending}
          onPress={save}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** SOC-01·02·07: 저장 성공 뒤에만 한 단계 뒤로 간다. */
export function ProfileFieldEditor({
  client,
  profile,
  field,
  back,
  onBack,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  field: ProfileField;
  back: string;
  onBack(): void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [original] = useState(() => profile[field]);
  const [raw, setRaw] = useState(original);
  const [failure, setFailure] = useState<ReturnType<typeof socialErrorCode>>();
  const change = useUpdateSocialProfile(client, profile.userId);
  const locked = field === 'handle' ? cooldownDays(profile) : 0;
  const validation = field === 'bio' ? validateBio(raw) : validateNickname(raw);
  const value = field === 'handle' ? validateHandle(raw).value : validation.value;
  const status = useHandleAvailability(
    client,
    raw,
    field === 'handle' && !locked && original !== raw,
  );
  const moderation = useProfileTextCheck(
    client,
    value,
    field === 'nickname',
    field !== 'handle' && validation.valid && original !== value,
  );
  const valid =
    value !== original &&
    !locked &&
    !change.isPending &&
    !failure &&
    (field === 'handle'
      ? status === 'ok'
      : validation.valid && moderation !== 'banned' && moderation !== 'reserved');
  function save() {
    if (!valid) return;
    change.mutate(
      { [field]: value },
      {
        onSuccess: onBack,
        onError: (error) => {
          const code = socialErrorCode(error);
          if (code === 'unknown' || code === 'network') toast(() => t('social.save.failed'));
          else setFailure(code);
        },
      },
    );
  }
  return (
    <KeyboardAvoidingView behavior="padding" style={s.fill}>
      <ProfileNav
        title={t(`social.${field}`)}
        back={back}
        onBack={onBack}
        onDone={save}
        disabled={!valid}
        busy={change.isPending}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.page, { gap: m.space.sm, paddingTop: m.space.md }]}
      >
        <Field
          field={field}
          value={raw}
          onChange={(text) => {
            setRaw(text);
            setFailure(undefined);
          }}
          disabled={!!locked || change.isPending}
        />
        {field === 'handle' ? (
          <>
            {locked || failure === 'handle_cooldown' ? (
              <Text style={[s.support, { color: colors.muted }]}>
                {t('social.handle.cooldown', { days: locked || 30 })}
              </Text>
            ) : (
              <Hint
                status={
                  failure === 'taken'
                    ? 'taken'
                    : failure === 'handle_held' || failure === 'reserved' || failure === 'banned'
                      ? 'unavailable'
                      : status
                }
              />
            )}
            <Text
              style={[
                s.support,
                {
                  color: colors.ink2,
                  backgroundColor: colors.chip,
                  padding: m.space.lg,
                  borderRadius: m.radius.card,
                  marginTop: m.space.sm,
                },
              ]}
            >
              {t('social.handle.changeHelp', { handle: original })}
            </Text>
          </>
        ) : (
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={[s.support, { color: colors.muted }]}>
              {field === 'bio' ? t('social.bio.limit') : ''}
            </Text>
            <Text style={[s.support, { color: colors.muted }]}>
              {t('social.count.remaining', {
                count: (field === 'bio' ? 80 : 20) - validation.count,
              })}
            </Text>
          </View>
        )}
        {field !== 'handle' &&
          (failure === 'banned' ||
            moderation === 'banned' ||
            failure === 'reserved' ||
            moderation === 'reserved') && (
            <Text accessibilityRole="alert" style={[s.support, { color: colors.danger }]}>
              {t(
                failure === 'reserved' || moderation === 'reserved'
                  ? 'social.handle.unavailable'
                  : 'social.text.banned',
              )}
            </Text>
          )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
