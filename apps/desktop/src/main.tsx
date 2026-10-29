import { t } from '@nodii/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { installAppMenu } from './lib/commands';
import { toast } from 'sonner';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

void installAppMenu().catch(() => toast.error(t('app.menu.failed')));
