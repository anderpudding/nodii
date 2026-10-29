import { configurePseudoLocale } from './lib/pseudo-locale';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './app/ErrorBoundary';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './index.css';

configurePseudoLocale();

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
