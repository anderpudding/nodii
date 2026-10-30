import { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, cleanup, fireEvent } from '@testing-library/react-native';
import { setLocale, t } from '@nodii/i18n';
import { useLocale } from './use-locale';

let mounts = 0;
function RootOnly() {
  useLocale();
  return <Stack screenOptions={{ headerShown: false }} />;
}
function Content({ subscribe = false }: { subscribe?: boolean }) {
  return subscribe ? <Subscribed /> : <Fields />;
}
function Subscribed() {
  useLocale();
  return <Fields />;
}
function Fields() {
  const [draft, setDraft] = useState('');
  useEffect(() => {
    mounts++;
  }, []);
  return (
    <>
      <Text>{t('settings.language')}</Text>
      <TextInput testID="draft" value={draft} onChangeText={setDraft} />
    </>
  );
}
afterEach(cleanup);
it('실제 Stack은 루트 구독만으로 라우트 문구를 갱신하지 않는다', async () => {
  renderRouter({ _layout: RootOnly, index: () => <Content /> });
  await screen.findByText('언어');
  act(() => setLocale('en'));
  expect(screen.queryByText('Language')).toBeNull();
  expect(screen.getByText('언어')).toBeTruthy();
});
it('라우트 구독은 열린 화면과 입력 상태를 유지하며 즉시 바꾼다', async () => {
  mounts = 0;
  renderRouter({ _layout: RootOnly, index: () => <Content subscribe /> });
  await screen.findByText('언어');
  fireEvent.changeText(screen.getByTestId('draft'), 'keep draft');
  act(() => setLocale('en'));
  expect(await screen.findByText('Language')).toBeTruthy();
  expect(screen.getByTestId('draft').props.value).toBe('keep draft');
  expect(mounts).toBe(1);
});
