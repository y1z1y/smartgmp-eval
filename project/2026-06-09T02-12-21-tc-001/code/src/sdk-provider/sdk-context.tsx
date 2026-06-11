import React, { createContext, useContext, useMemo } from 'react';
import type { HtwSdk } from './sdk';
import { mockHtwSdk } from './sdk';
import { builtinHtwSdk } from './htw-sdk';

const SdkContext = createContext<HtwSdk | null>(null);

export interface SdkProviderProps {
  sdk?: HtwSdk | null;
  children: React.ReactNode;
}

/**
 * SDK Provider — 内置了完整的 htw-sdk 实现，开箱即用。
 *
 * 三级降级：传入的 sdk > 内置 builtinHtwSdk > mockHtwSdk (SSR)
 *
 *   // 最常见用法：直接使用，内置实现自动生效
 *   <SdkProvider>
 *     <QjCashback ... />
 *   </SdkProvider>
 *
 *   // 宿主想覆盖部分实现
 *   <SdkProvider sdk={customSdk}>
 *     <QjCashback ... />
 *   </SdkProvider>
 */
export function SdkProvider({ sdk, children }: SdkProviderProps) {
  const value = useMemo<HtwSdk>(() => {
    if (sdk) return sdk;
    if (typeof window !== 'undefined') return builtinHtwSdk;
    return mockHtwSdk;
  }, [sdk]);

  return <SdkContext.Provider value={value}>{children}</SdkContext.Provider>;
}

/**
 * 组件及其子组件 / api 层统一通过此 hook 获取 SDK。
 *
 *   const sdk = useSdk();
 *   sdk.kop.send(...)
 *   sdk.goto.open(...)
 *   sdk.share.clickShare(...)
 *
 * 未被 SdkProvider 包裹时也能工作（降级到内置实现）。
 */
export function useSdk(): HtwSdk {
  const ctx = useContext(SdkContext);
  if (ctx) return ctx;

  if (typeof window !== 'undefined') return builtinHtwSdk;
  return mockHtwSdk;
}
