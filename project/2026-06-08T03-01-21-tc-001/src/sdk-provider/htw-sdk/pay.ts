import { getMethodByEnv, getEnv } from './xenv';
import { open } from './goto';
import { getUserInfo } from './user';
import { diffParamsForTrack } from './error-track';
import { getAllQuery } from './url';

const SAFE_APP_ID = '10000';

export interface DPayParams {
  outTradeId: string;
  codeOrigin?: string;
}

function compareVersion(version1: string, version2: string): number {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function handlePayH5(params: DPayParams): Promise<boolean> {
  console.log(`h5 不支持支付 ${JSON.stringify(params)}`);
  return Promise.resolve(false);
}

function handlePayInMp({ outTradeId, codeOrigin }: DPayParams): Promise<boolean> {
  diffParamsForTrack('handlePayInMp', { outTradeId }, ['outTradeId']);
  return new Promise(async (resolve) => {
    const handlePageVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resolve(true);
        document.removeEventListener('visibilitychange', handlePageVisibilityChange);
      }
    };
    document.addEventListener('visibilitychange', handlePageVisibilityChange);

    let alimp = `/qingju/subpackages/paymentProcess/cashier/cashier?out_trade_id=${outTradeId}`;
    const whiteList = ['PRODUCT_BUNDLE'];
    const APPID = 2019062865745088;

    if (whiteList.includes(codeOrigin!) && getEnv() === 'alimp') {
      const queryParams = getAllQuery(window.location.href);
      const { mpversion, appversion, app_version, xcx_appversion, xcx_app_version } = queryParams;
      const alipayVersion =
        mpversion || appversion || app_version || xcx_appversion || xcx_app_version || '0.0.0';
      const checkVersion = mpversion ? '19.4.0' : '7.0.90';
      if (compareVersion(alipayVersion.split('-')[0], checkVersion) < 0) {
        (window as any).__mf_sdk__?.showToast?.('版本过低暂不支持支付，请升级小程序版本后重试');
        return;
      }
      alimp += `&appId=${APPID}`;
      if (getEnv() === 'alimp') {
        alimp += `&ext_info={"safe_app_id":"${SAFE_APP_ID}"}`;
      }
    }
    open({
      wxmp: `/qingju/subpackages/paymentProcess/common_pay/common_pay?out_trade_id=${outTradeId}`,
      qjwxmp: `/pages/common_pay/common_pay?out_trade_id=${outTradeId}`,
      alimp,
      passenger: '',
    });
  });
}

async function handlePayPassenger({ outTradeId }: DPayParams): Promise<boolean> {
  diffParamsForTrack('handlePayPassenger', { outTradeId }, ['outTradeId']);
  const userInfo = await getUserInfo();
  if (!userInfo?.login) return false;
  return new Promise((resolve) => {
    (window as any).Fusion.openUniPay(
      {
        out_trade_id: outTradeId,
        out_token: userInfo?.login ? userInfo.token : '',
        wx_app_id: 'wxd5b252a1660012b4',
        ext_info: { safe_app_id: SAFE_APP_ID },
      },
      ({ code }: { code: number }) => {
        resolve(code === 1);
      },
    );
  });
}

let payDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const payFn = getMethodByEnv({
  wxmp: handlePayInMp,
  alimp: handlePayInMp,
  qjwxmp: handlePayInMp,
  passenger: handlePayPassenger,
  h5: handlePayH5,
  crwxmp: handlePayInMp,
});

export const handlePay = (params: DPayParams): Promise<boolean> => {
  if (payDebounceTimer) return Promise.resolve(false);
  payDebounceTimer = setTimeout(() => {
    payDebounceTimer = null;
  }, 1000);
  return payFn(params);
};
