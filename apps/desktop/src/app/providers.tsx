import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { startConnectivity } from '../lib/connectivity';
import { startTheme } from '../lib/theme';
import { CACHE_MAX_AGE } from '../lib/query-persister';

/** 서버 캐시와 토스트를 공유하고 기기별 테마를 적용한다. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } } }),
  );
  useEffect(startConnectivity, []);
  useEffect(startTheme, []);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-center"
        duration={5000}
        toastOptions={{
          unstyled: true,
          classNames: { toast: 'toast', title: 'toast-title', actionButton: 'toast-action' },
        }}
      />
    </QueryClientProvider>
  );
}
