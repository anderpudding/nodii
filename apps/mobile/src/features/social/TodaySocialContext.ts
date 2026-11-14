import { createContext } from 'react';
import type { ReactNode } from 'react';

export const TodaySocialContext = createContext<{
  friendId: string | null;
  avatars?: ReactNode;
}>({ friendId: null });
