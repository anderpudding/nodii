import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// jsdom은 삭제된 초점을 Document로 돌려 window blur를 잘못 발생시킨다.
beforeEach(() => {
  document.body.tabIndex = -1;
  document.body.focus();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  vi.useRealTimers();
});
afterAll(() => server.close());

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
// input-otp가 사용하는 레이아웃 관찰은 jsdom에 없으므로 관찰자만 대체한다.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
if (!document.elementFromPoint) document.elementFromPoint = () => null;
// Sonner의 드래그 제스처 API는 jsdom에 없어 빈 구현으로 대체한다.
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};
// Radix 메뉴의 primary-pointer 판정에 필요한 button/ctrlKey를 jsdom에서도 전달한다.
if (!window.PointerEvent) vi.stubGlobal('PointerEvent', MouseEvent);
if (!HTMLElement.prototype.hasPointerCapture) HTMLElement.prototype.hasPointerCapture = () => false;
if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {};
