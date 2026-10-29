import { t } from '@nodii/i18n';
import { BrandMark } from '../components/ui/brand-mark';
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
      setError(t('mobile.update.failed'));
    }
  }
  return (
    <main className="center-screen">
      <section className="auth-panel" aria-labelledby="update-title">
        <header className="auth-heading">
          <p className="brand">
            <BrandMark />
            Nodii
          </p>
          <h1 id="update-title">{t('app.update.title')}</h1>
          <p className="supporting">
            {t('mobile.update.title')}
            <br />
            {t('app.update.data')}
          </p>
        </header>
        <Button
          size="auth"
          className="full-width"
          disabled={!validId}
          onClick={() => void openStore()}
        >
          {t('mobile.update.action')}
        </Button>
        {!validId && <p className="supporting version-details">{t('app.update.pending')}</p>}
        <p className="supporting version-details">
          {t('app.update.versions', { current: currentVersion, minimum: minimumVersion })}
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
