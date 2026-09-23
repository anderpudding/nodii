import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installAppMenu } from './lib/commands';
import { toast } from 'sonner';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void installAppMenu().catch(() => toast.error('메뉴를 준비하지 못했어요. 앱을 다시 열어 주세요.'));
