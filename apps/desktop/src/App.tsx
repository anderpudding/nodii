import { AppGate } from './app/AppGate';
import { Providers } from './app/providers';
import { supabase } from './lib/supabase';

/** 설정이 없는 개발 환경도 빈 창 대신 복구 가능한 안내를 보여준다. */
export function App() {
  return (
    <Providers>
      {supabase ? (
        <AppGate client={supabase} />
      ) : (
        <main className="center-screen">
          <section className="auth-panel">
            <p className="brand">Nodii</p>
            <h1>연결 설정이 필요해요</h1>
            <p className="supporting">
              개발 환경의 Supabase 주소와 공개 키를 설정한 뒤 다시 실행해 주세요.
            </p>
          </section>
        </main>
      )}
    </Providers>
  );
}
