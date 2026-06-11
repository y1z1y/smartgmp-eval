/* eslint-disable no-param-reassign */
import axios from 'axios';
// @ts-ignore
import { wsgParams, getSign } from '@didi/wsgsdk';
import qs from 'qs';
import { kopSignH5 } from './kop-sign';
import { getAllQuery } from '../utils/url';

const appKey = 'h5appbcd0af7461691c1e30bcd61098f';
const appSec = 'h5app07a02944776b7638e9b90793363';

function alphabeticalSort(a: string, b: string) {
  return a.localeCompare(b);
}

const kopHostMap: Record<string, string> = {
  online: 'https://htwkop-st.xiaojukeji.com/gateway',
  pre: 'https://predaijiays.kuaidadi.com/gateway',
  stable: 'https://pinzhi.didichuxing.com/kop_osim/gateway',
  osim: 'https://pinzhi.didichuxing.com/kop_osim/gateway',
};

export const instance = axios.create({
  baseURL: typeof window !== 'undefined' ? kopHostMap[(window as any).__env__] : kopHostMap.online,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'X-App-Content-Type': 'application/json',
  },
  params: {},
  paramsSerializer(params) {
    return qs.stringify(params, { sort: alphabeticalSort });
  },
});

function wsgParamsPromisify(url: string) {
  return new Promise((resolve) => {
    wsgParams({ url }, (wsgenv: string) => {
      resolve(wsgenv);
    });
  });
}

instance.interceptors.request.use(
  async (config) => {
    config.params = {
      apiVersion: '1.0.0',
      appKey,
      appVersion: '1.0.0',
      ttid: 'h5',
      osType: '3',
      osVersion: '1.0.0',
      mobileType: 'web',
      userRole: '1',
      timestamp: Date.now(),
      ...config.params,
    };
    const paramsString = qs.stringify(config.params, { sort: alphabeticalSort });
    const url = `${config.baseURL}${config.url}?${paramsString}`;

    const wsgenv = await wsgParamsPromisify(url);
    config.data.wsgenv = wsgenv;

    config.params.sign = kopSignH5(appSec, config.params, config.data);

    config.data = JSON.stringify(config.data);

    config.params.wsgsig = getSign({
      noDomainCheck: true,
      contentType: 'application/json',
      bodyString: config.data,
      paramsString,
    });
    return config;
  },
  (error) => Promise.reject(error),
);

export async function send<T, P>(api: string, params: P) {
  try {
    const res = await instance.post<T>('', params, {
      params: {
        api,
      },
    });
    return res;
  } catch (error: any) {
    const code = error.code || 'OTHER';
    const status = error.status || 999;
    if (typeof window !== 'undefined' && (window as any).Omega?.trackEvent) {
      (window as any).Omega.trackEvent('tech_px_kop_error', '', {
        code,
        message: error.message || error.name,
        status,
        api,
        params: JSON.stringify(params),
      });
    }
    const data: T = {
      code: 999,
      data: undefined,
    } as any;
    return Promise.resolve({
      data,
      status,
      statusText:
        error.response && error.response.statusText ? error.response.statusText : 'Error',
      headers: {},
    });
  }
}

export const http = axios.create({
  baseURL: typeof window !== 'undefined' ? (window as any).baseURL : '',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  params: {},
});

if (typeof window !== 'undefined') {
  const query = getAllQuery(window.location.href) || {};
  const osim = query.osim;
  const simCluster =
    localStorage.getItem('didi-header-sim-cluster') ||
    ((window as any).__env__ === 'stable' ? osim : '');
  if (simCluster) {
    instance.defaults.headers['didi-header-sim-cluster'] = simCluster;
  }
}
