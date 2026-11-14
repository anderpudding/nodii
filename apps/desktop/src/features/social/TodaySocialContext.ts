import { createContext } from 'react';
import type { ReactNode } from 'react';

export const TodaySocialContext = createContext<{
  friendId: string | null;
  active?: boolean;
  avatars?: ReactNode;
  management?: ReactNode;
}>({ friendId: null });
