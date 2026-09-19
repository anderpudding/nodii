import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { startConnectivity } from '../lib/connectivity';
import { CACHE_MAX_AGE } from '../lib/query-persister';

/** 서버 캐시와 토스트를 공유하고 7단계 전까지는 시스템 테마만 따른다. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } } }),
  );
  useEffect(startConnectivity, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => document.documentElement.classList.toggle('dark', media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
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
