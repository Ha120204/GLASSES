import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';

export const makeStore = (apiInstance: typeof api = api) =>
  configureStore({
    reducer: { [apiInstance.reducerPath]: apiInstance.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiInstance.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
