'use client';

import { Provider } from 'react-redux';
import { useRef } from 'react';
import { makeStore, type AppStore } from './store';

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();
  return <Provider store={storeRef.current}>{children}</Provider>;
}
