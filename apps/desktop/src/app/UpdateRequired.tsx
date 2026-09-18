import { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from '../components/ui/button';

/** SET-05: 호환되지 않는 앱은 데이터 화면 대신 스토어 업데이트를 안내한다. */
export function UpdateRequired({
  currentVersion,
  minimumVersion,
  appStoreId,
}: {
  currentVersion: string;
  minimumVersion: string;
  appStoreId: string;
}) {
  const [error, setError] = useState('');
  const validId = /^\d+$/.test(appStoreId);
  async function openStore() {
    setError('');
    try {
      if (isTauri()) await openUrl(`macappstore://apps.apple.com/app/id${appStoreId}`);
      else
        window.open(`https://apps.apple.com/app/id${appStoreId}`, '_blank', 'noopener,noreferrer');
    } catch {
      setError('App Store를 열지 못했어요. 다시 시도해 주세요.');
    }
  }
  return (
    <main className="center-screen">
      <section className="auth-panel" aria-labelledby="update-title">
        <header className="auth-heading">
          <p className="brand">Nodii</p>
          <h1 id="update-title">새 버전이 필요해요</h1>
          <p className="supporting">
            App Store에서 업데이트해 주세요.
            <br />
            기록한 데이터는 그대로 유지돼요.
          </p>
        </header>
        <Button
          size="auth"
          className="full-width"
          disabled={!validId}
          onClick={() => void openStore()}
        >
          App Store에서 업데이트
        </Button>
        {!validId && (
          <p className="supporting version-details">App Store 링크를 준비하고 있어요.</p>
        )}
        <p className="supporting version-details">
          지금 버전 {currentVersion} · 필요한 버전 {minimumVersion}
        </p>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
