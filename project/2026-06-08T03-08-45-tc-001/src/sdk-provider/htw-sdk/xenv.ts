import { load } from './script';
import axios from 'axios';
import qs from 'qs';
import { getAllQuery } from '../utils/url';

export type XEnv =
  | 'wxmp'
  | 'alimp'
  | 'qjwxmp'
  | 'crwxmp'
  | 'passenger'
  | 'h5'
  | 'wxh5'
  | '';

let xenv: XEnv = '';

export function getEnv(): XEnv {
  if (xenv) return xenv;
  if (typeof window === 'undefined') return 'h5';

  const ua: string = window.navigator.userAgent;
  const { env = '', xenv: xenvQuery = '' } = getAllQuery(window.location.href);
  if (/didi\.passenger/.test(ua)) {
    xenv = 'passenger';
  } else if (/MicroMessenger/i.test(ua)) {
    if (/miniProgram/i.test(ua)) {
      if (env === 'qj') {
        xenv = 'qjwxmp';
      } else if (env === 'crwxmp' || xenvQuery === 'crwxmp') {
        xenv = 'crwxmp';
      } else {
        xenv = 'wxmp';
      }
    } else {
      xenv = 'wxh5';
    }
  } else if (/AlipayClient/i.test(ua)) {
    xenv = 'alimp';
  } else {
    xenv = 'h5';
  }
  return xenv;
}

if (typeof window !== 'undefined') {
  getEnv();
}

interface AllEnvConfig<T> {
  wxmp: T;
  alimp: T;
  qjwxmp: T;
  crwxmp?: T;
  passenger: T;
  h5: T;
  wxh5?: T;
}

export function getMethodByEnv<T>(config: AllEnvConfig<T>): T {
  switch (getEnv()) {
    case 'wxmp':
      return config.wxmp;
    case 'alimp':
      return config.alimp;
    case 'qjwxmp':
      return config.qjwxmp;
    case 'crwxmp':
      return config.crwxmp ?? config.wxmp;
    case 'passenger':
      return config.passenger;
    case 'wxh5':
      return config.wxh5 || config.h5;
    case 'h5':
    default:
      return config.h5;
  }
}

interface TaxiResponse<T> {
  errno: number;
  errmsg: string;
  data: T;
}

async function commonInit(): Promise<boolean> {
  const isSupportWebp = false;
  if (typeof window !== 'undefined') {
    (window as any).isSupportWebp = isSupportWebp;
  }
  return isSupportWebp;
}

interface WXConfig {
  appId: string;
  nonceStr: string;
  timestamp: number;
  signature: string;
}

export async function wxReady(): Promise<boolean> {
  const [{ data }, wx] = await Promise.all([
    axios.post<TaxiResponse<WXConfig>>(
      'https://common.diditaxi.com.cn/general/webEntry/jsapiticket?',
      qs.stringify({
        url: window.location.origin + window.location.pathname + window.location.search,
      }),
    ),
    load<typeof window.wx>('https://res.wx.qq.com/open/js/jweixin-1.6.0.js', 'wx'),
    commonInit(),
  ]);

  return new Promise((resolve) => {
    if (data.errno === 0) {
      wx.config({
        debug: false,
        ...data.data,
        jsApiList: ['getLocation', 'updateAppMessageShareData'],
      });
      wx.ready(() => {
        resolve(true);
      });
    } else {
      resolve(false);
    }
  });
}

export async function alimpInit(): Promise<boolean> {
  commonInit();
  const alimpSdk = await load<typeof window.my>('https://appx/web-view.min.js', 'my');
  return !!alimpSdk;
}

export async function passengerInit(): Promise<boolean> {
  commonInit();
  if (typeof window !== 'undefined' && (window as any).Fusion) {
    return true;
  }
  const Fusion = await load<typeof window.Fusion>(
    'https://static.udache.com/hybrid-fusion/1.4.0/fusion.js',
    'Fusion',
  );
  return !!Fusion;
}

export const init = getMethodByEnv<() => Promise<boolean>>({
  wxmp: wxReady,
  alimp: alimpInit,
  qjwxmp: wxReady,
  crwxmp: wxReady,
  passenger: passengerInit,
  wxh5: wxReady,
  h5: commonInit,
});

export const getQjChannel = getMethodByEnv({
  wxmp: 1,
  alimp: 6,
  qjwxmp: 0,
  crwxmp: 81,
  passenger: 5,
  h5: 99,
});

export const getChannel = getMethodByEnv({
  wxmp: 'didi_wx_miniapp',
  alimp: 'didi_zfb_miniapp',
  qjwxmp: 'htw_wx_miniapp',
  crwxmp: 'car_rent_wechat',
  passenger: 'didi_activity',
  h5: 'htw_wx_miniapp',
});

export const getAppType = getMethodByEnv({
  wxmp: 'didi_h5',
  alimp: 'didi_zfb',
  qjwxmp: 'h5',
  crwxmp: 'crwxmp',
  passenger: 'htw_didi',
  h5: 'h5',
});
