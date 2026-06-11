// @ts-ignore
import { initSDK } from '@didi/wsgsdk';
import { diffParamsForTrack } from './error-track';

export async function initWsgsdk(uid: string) {
  diffParamsForTrack('initWsgsdk', { uid }, ['uid']);
  const sdkEnv =
    typeof window !== 'undefined' && (window as any).__env__ === 'online' ? 'CN' : 'test';
  const initParams = {
    appId: '01040700',
    env: sdkEnv,
    ut: 'query',
    wsgenvType: 'common',
    uid,
    bizId: 'ff57ff3701cfe94e3c2cf01c4df824b7',
    appVer: '0.1.35',
    os: '4',
  };
  initSDK(initParams);
}
