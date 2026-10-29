import { t } from '@nodii/i18n';
import { useLocale } from './lib/language';
import { AppGate } from './app/AppGate';
import { Providers } from './app/providers';
import { supabase } from './lib/supabase';

/** 설정이 없는 개발 환경도 빈 창 대신 복구 가능한 안내를 보여준다. */
export function App() {
  useLocale();
  return (
    <Providers>
      {supabase ? (
        <AppGate client={supabase} />
      ) : (
        <main className="center-screen">
          <section className="auth-panel">
            <p className="brand">Nodii</p>
            <h1>{t('app.config.title')}</h1>
            <p className="supporting">{t('app.config.description')}</p>
          </section>
        </main>
      )}
    </Providers>
  );
}
