import { useEffect, useReducer, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  normalizeAuthError,
  sendOtp,
  signInReviewAccount,
  verifyOtp,
  type NodiiClient,
} from '@nodii/api';
import { goalInk, goalTint } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import {
  authErrorMessage,
  cooldownRemaining,
  initialLoginState,
  isReviewEmail,
  loginReducer,
} from './login-state';

/** AUTH-01/07/08・MOB-05: 이메일과 자동완성 코드 입력을 같은 키보드 회피 흐름에 둔다. */
export function Login({
  client,
  reviewAccountEmail,
}: {
  client: NodiiClient;
  reviewAccountEmail: string;
}) {
  const [state, dispatch] = useReducer(loginReducer, initialLoginState);
  const [now, setNow] = useState(Date.now);
  const [focused, setFocused] = useState<string | null>(null);
  const busy = useRef(false);
  const codeInput = useRef<TextInput>(null);
  const { colors, isDark } = useTheme();
  const email = state.email.trim().toLowerCase();
  const review = isReviewEmail(email, reviewAccountEmail);
  const remaining = cooldownRemaining(state, state.step === 'code' ? state.codeEmail : email, now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function request(kind: 'email' | 'resend' | 'code', token = state.token) {
    if (busy.current || state.step === 'success') return;
    if (kind === 'code' && (state.step !== 'code' || !/^\d{6}$/.test(token))) return;
    if (kind === 'resend' && (state.step !== 'code' || remaining > 0)) return;
    if (kind === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        dispatch({ type: 'failed', error: t('auth.email.invalid'), now: Date.now() });
        return;
      }
      if (review && !state.password) return;
      if (!review && remaining > 0) {
        dispatch({ type: 'code', email });
        return;
      }
    }
    busy.current = true;
    dispatch({ type: 'begin' });
    const destination = kind === 'email' ? email : state.codeEmail;
    try {
      if (kind === 'code') {
        await verifyOtp(client, destination, token);
        dispatch({ type: 'success' });
      } else if (kind === 'email' && review) {
        await signInReviewAccount(client, email, state.password);
        dispatch({ type: 'success' });
      } else {
        await sendOtp(client, destination);
        const timestamp = Date.now();
        setNow(timestamp);
        dispatch({ type: 'sent', email: destination, now: timestamp });
      }
    } catch (error) {
      dispatch({
        type: 'failed',
        error: authErrorMessage(error, kind === 'email' && review),
        now: Date.now(),
        rateLimitedEmail:
          normalizeAuthError(error).code === 'rate_limited' && !(kind === 'email' && review)
            ? destination
            : undefined,
      });
      if (kind === 'code') codeInput.current?.focus();
    } finally {
      busy.current = false;
    }
  }
  const fieldStyle = (name: string) => [
    styles.input,
    {
      color: colors.ink,
      backgroundColor: colors.surface,
      borderColor: focused === name ? colors.focus : colors.field,
      outlineColor: colors.focus,
      outlineWidth: focused === name ? m.focusRing : 0,
      outlineStyle: 'solid' as const,
    },
  ];
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
      >
        <View
          style={styles.marks}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {['#4F7CFF', '#3FB28A', '#E9C23A', '#A06CD5'].map((color, index) => (
            <View
              key={color}
              style={[
                styles.mark,
                {
                  backgroundColor:
                    index === 3 ? colors.bg : goalTint(color, colors.bg, isDark ? 0.22 : 0.14),
                  borderColor: goalInk(color, colors.bg, isDark),
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.brand, { color: colors.muted }]}>{t('auth.brand')}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
          {t(state.step === 'code' ? 'auth.code.title' : 'auth.title')}
        </Text>
        <Text style={[styles.description, { color: colors.ink2 }]}>
          {state.step === 'code'
            ? t('auth.code.description', { email: state.codeEmail })
            : t('auth.description')}
        </Text>
        {state.step !== 'code' ? (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>{t('auth.email')}</Text>
            <TextInput
              accessibilityLabel={t('auth.email')}
              placeholder={t('auth.email.placeholder')}
              placeholderTextColor={colors.muted}
              value={state.email}
              onChangeText={(value) => dispatch({ type: 'email', value })}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              editable={!state.pending}
              returnKeyType={review ? 'next' : 'send'}
              onSubmitEditing={() => {
                if (!review) void request('email');
              }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              style={fieldStyle('email')}
            />
            {review && (
              <>
                <Text style={[styles.label, { color: colors.muted }]}>{t('auth.password')}</Text>
                <TextInput
                  accessibilityLabel={t('auth.password')}
                  value={state.password}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="current-password"
                  editable={!state.pending}
                  onChangeText={(value) => dispatch({ type: 'password', value })}
                  returnKeyType="go"
                  onSubmitEditing={() => void request('email')}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  style={fieldStyle('password')}
                />
              </>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>{t('auth.code')}</Text>
            <View style={styles.codeArea}>
              <View
                style={styles.slots}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.slot,
                      {
                        backgroundColor: colors.surface,
                        borderColor: focused === 'code' ? colors.focus : colors.field,
                      },
                    ]}
                  >
                    <Text style={[styles.digit, { color: colors.ink }]}>
                      {state.token[index] ?? ''}
                    </Text>
                  </View>
                ))}
              </View>
              <TextInput
                ref={codeInput}
                accessibilityLabel={t('auth.code.label')}
                value={state.token}
                autoFocus
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={6}
                editable={!state.pending}
                caretHidden
                style={[
                  styles.codeInput,
                  {
                    outlineColor: colors.focus,
                    outlineWidth: focused === 'code' ? m.focusRing : 0,
                    outlineStyle: 'solid',
                  },
                ]}
                onFocus={() => setFocused('code')}
                onBlur={() => setFocused(null)}
                onChangeText={(value) => {
                  const digits = value.replace(/\D/g, '').slice(0, 6);
                  dispatch({ type: 'token', value: digits });
                  if (digits.length === 6) void request('code', digits);
                }}
                onSubmitEditing={() => void request('code')}
              />
            </View>
          </>
        )}
        {!!state.error && (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[styles.error, { color: colors.danger }]}
          >
            {state.error}
          </Text>
        )}
        <View style={styles.actions}>
          <Button
            label={
              state.pending
                ? t(
                    state.step === 'code'
                      ? 'auth.verifying'
                      : review
                        ? 'auth.loggingIn'
                        : 'auth.sending',
                  )
                : t(state.step === 'code' || review ? 'auth.login' : 'auth.send')
            }
            busy={state.pending}
            disabled={
              state.pending ||
              (state.step === 'code'
                ? state.token.length !== 6
                : !email || (review && !state.password))
            }
            onPress={() => void request(state.step === 'code' ? 'code' : 'email')}
          />
          {state.step === 'code' && (
            <>
              <Button
                secondary
                label={
                  remaining > 0
                    ? t('auth.resendCountdown', { seconds: remaining })
                    : t('auth.resend')
                }
                disabled={state.pending || remaining > 0}
                onPress={() => void request('resend')}
              />
              <Button
                secondary
                label={t('auth.changeEmail')}
                disabled={state.pending}
                onPress={() => dispatch({ type: 'changeEmail' })}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: m.space.group },
  marks: { flexDirection: 'row', gap: m.space.sm, marginBottom: m.space.group },
  mark: {
    width: m.type.title,
    height: m.type.title,
    borderRadius: m.radius.mark,
    borderWidth: m.border,
  },
  brand: {
    fontFamily: m.fontBold,
    fontSize: m.type.button,
    fontWeight: '700',
    marginBottom: m.space.sm,
  },
  title: {
    fontFamily: m.fontBold,
    fontSize: m.type.title,
    fontWeight: '700',
    letterSpacing: m.letterSpacing.title,
    lineHeight: m.type.title * m.lineHeight.title,
  },
  description: {
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
    marginTop: m.space.md,
    marginBottom: m.space.group,
  },
  label: {
    fontFamily: m.fontSemiBold,
    fontSize: m.type.label,
    fontWeight: '600',
    marginBottom: m.space.sm,
    marginTop: m.space.md,
  },
  input: {
    minHeight: m.height.field,
    borderRadius: m.radius.field,
    borderWidth: m.border,
    paddingHorizontal: m.space.lg,
    paddingVertical: m.space.md,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
  },
  codeArea: { minHeight: m.height.field },
  slots: { flexDirection: 'row', gap: m.space.sm },
  slot: {
    flex: 1,
    minHeight: m.height.field,
    borderRadius: m.radius.field,
    borderWidth: m.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digit: {
    fontFamily: m.fontBold,
    fontSize: m.type.heading,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  codeInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    borderRadius: m.radius.field,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
  },
  error: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
    marginTop: m.space.md,
  },
  actions: { marginTop: m.space.group, gap: m.space.sm },
});
