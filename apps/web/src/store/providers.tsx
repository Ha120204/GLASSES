'use client';

import { Provider } from 'react-redux';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useEffect, useRef } from 'react';
import { api } from './api';
import { makeStore, type AppStore } from './store';

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const storeRef = useRef<{ api: typeof api; store: AppStore } | null>(null);
  // Fast Refresh keeps refs, but a new API instance needs its matching middleware and reducer.
  if (!storeRef.current || storeRef.current.api !== api) storeRef.current = { api, store: makeStore(api) };
  const store = storeRef.current.store;
  useEffect(() => setupListeners(store.dispatch), [store]);
  return <Provider store={store}>{children}</Provider>;
}
