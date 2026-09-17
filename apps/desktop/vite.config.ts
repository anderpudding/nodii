import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

// https://tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Rust 컴파일 오류가 가려지지 않게 한다
  clearScreen: false,
  server: {
    // Tauri는 고정 포트를 기대한다
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    // macOS 12의 WKWebView (Safari 15) 기준
    target: 'safari15',
  },
});
