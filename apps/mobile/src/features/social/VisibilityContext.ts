import { createContext } from 'react';

/** 소셜 플래그가 꺼진 화면에서는 기존 이름표와 편집을 유지한다. */
export const VisibilityContext = createContext(false);
