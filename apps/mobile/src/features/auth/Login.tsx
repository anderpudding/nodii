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
import { BrandMark } from '../../components/BrandMark';
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
  const { colors } = useTheme();
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
      backgroundColor: colors.chip,
      borderWidth: 1.5,
      borderColor: focused === name ? colors.ink : colors.chip,
    },
  ];
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
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
          <BrandMark />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
          {t(state.step === 'code' ? 'auth.code.title' : 'auth.title')}
        </Text>
        <Text style={[styles.description, { color: colors.ink2 }]}>
          {state.step === 'code' ? (
            <>
              <Text style={[styles.emailAddress, { color: colors.ink }]}>{state.codeEmail}</Text>
              {t('auth.code.description', { email: '' })}
            </>
          ) : (
            t('auth.description')
          )}
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
                        backgroundColor: colors.chip,
                        borderWidth: 1.5,
                        borderColor: focused === 'code' ? colors.ink : colors.chip,
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
                style={[styles.codeInput, {}]}
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
            <View style={styles.codeActions}>
              <Button
                quiet
                secondary
                label={t('auth.changeEmail')}
                disabled={state.pending}
                onPress={() => dispatch({ type: 'changeEmail' })}
              />
              {remaining > 0 ? (
                <Text style={[styles.countdown, { color: colors.muted }]}>
                  {t('auth.resendCountdown', {
                    minutes: Math.floor(remaining / 60),
                    seconds: String(remaining % 60).padStart(2, '0'),
                  })}
                </Text>
              ) : (
                <Button
                  quiet
                  secondary
                  label={t('auth.resend')}
                  disabled={state.pending}
                  onPress={() => void request('resend')}
                />
              )}
            </View>
          )}
        </View>
        {state.step !== 'code' && !review && (
          <Text style={[styles.help, { color: colors.muted }]}>{t('auth.email.help')}</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: m.space.lg + m.space.sm,
    paddingTop: m.space.lg,
    paddingBottom: m.space.page + m.space.lg,
  },
  marks: { flexDirection: 'row', gap: m.space.sm, marginBottom: m.space.lg + m.space.sm },
  title: {
    fontFamily: m.fontExtraBold,
    fontSize: m.type.title,
    fontWeight: '800',
    letterSpacing: m.letterSpacing.title,
    lineHeight: m.type.title * m.lineHeight.title,
  },
  description: {
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
    marginTop: m.space.md,
    marginBottom: m.space.lg + m.space.sm,
  },
  emailAddress: { fontFamily: m.fontBold, fontWeight: '700' },
  label: {
    fontFamily: m.fontBold,
    fontSize: m.type.label,
    fontWeight: '700',
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
    fontFamily: m.fontExtraBold,
    fontSize: m.type.heading,
    fontWeight: '800',
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
  codeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: m.space.sm,
  },
  countdown: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
    fontVariant: ['tabular-nums'],
    marginLeft: 'auto',
    maxWidth: '100%',
    textAlign: 'right',
  },
  help: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
    marginTop: m.space.lg * 2,
  },
});
