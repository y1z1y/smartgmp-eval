import { load } from './script';
import { getMethodByEnv, passengerInit } from './xenv';
import { getAllQuery } from './url';
import qs from 'qs';

const sdkURL =
  typeof window !== 'undefined' &&
  ((window as any).__env__ === 'online' || (window as any).__env__ === 'pre')
    ? '//static.udache.com/common/trinity-login/2.3.0/login.min.js'
    : '//passport-test.didichuxing.com/static/trinity-login/2.3.0/login.test.js';

export interface PassportConfig {
  appid: number;
  role: number;
}

interface PassportUserInfo {
  ticket: string;
  cell: string;
  uid: string;
}

interface UserInfoSuccess {
  login: true;
  token: string;
  phone: string;
  uid: string;
}
interface UserInfoFail {
  login: false;
  uid?: undefined;
  token?: undefined;
  phone?: undefined;
}
export type UserInfo = UserInfoSuccess | UserInfoFail;

export type PassportLoginResult = Partial<PassportUserInfo> & {
  login: boolean;
  uid?: string;
  token?: string;
  cell?: string;
};

interface IPassport {
  setConfig: (c: PassportConfig) => void;
  isLogin: (success: (info: PassportLoginResult) => void, fail: (error: Error) => void) => void;
  login: (success: (info: PassportUserInfo) => void, fail: (error: Error) => void) => void;
  logout: (success: () => void, fail: () => void) => void;
}

let sdkPromise: Promise<IPassport>;

async function getPassport() {
  if (!sdkPromise) {
    sdkPromise = load<IPassport>(sdkURL, 'login');
  }
  const passport = await sdkPromise;
  passport.setConfig({ appid: 30004, role: 1 });
  return passport;
}

async function getUserInfoH5(): Promise<UserInfo> {
  const passport = await getPassport();
  return new Promise((resolve) => {
    passport.isLogin(
      (response: PassportLoginResult) => {
        if (!response.login) {
          resolve({ login: false });
          return;
        }
        resolve({
          login: true,
          uid: response.uid as string,
          token: response.ticket as string,
          phone: response.cell as string,
        });
      },
      () => resolve({ login: false }),
    );
  });
}

async function getUserInfoWx(): Promise<UserInfo> {
  const query = getAllQuery(window.location.href);
  if (query.uid && query.token) {
    return { login: true, uid: query.uid, token: query.token, phone: query.phone };
  }
  return { login: false };
}

async function getUserInfoPassenger(): Promise<UserInfo> {
  await passengerInit();
  return new Promise((resolve) => {
    (window as any).Fusion.getUserInfo({}, (data: any) => {
      if (data.token) {
        resolve({ login: true, uid: data.uid, token: data.token, phone: data.phone });
      } else {
        resolve({ login: false });
      }
    });
  });
}

let userInfoPromise: Promise<UserInfo>;

export const getUserInfo = async () => {
  if (userInfoPromise) {
    const info = await userInfoPromise;
    if (info?.login) return info;
  }
  const method = getMethodByEnv({
    wxmp: getUserInfoWx,
    alimp: getUserInfoWx,
    qjwxmp: getUserInfoWx,
    crwxmp: getUserInfoWx,
    passenger: getUserInfoPassenger,
    h5: getUserInfoH5,
  });
  userInfoPromise = method();
  return userInfoPromise;
};

async function loginH5(): Promise<UserInfo> {
  const passport = await getPassport();
  return new Promise((resolve) => {
    passport.login(
      (response: PassportUserInfo) => {
        resolve({ login: true, uid: response.uid, token: response.ticket, phone: response.cell });
      },
      () => resolve({ login: false }),
    );
  });
}

async function loginWX(): Promise<undefined> {
  const query = getAllQuery(window.location.href);
  delete query.token;
  delete query.phone;
  delete query.uid;
  const search = qs.stringify(query, { arrayFormat: 'brackets', addQueryPrefix: true });
  const targetUrl = encodeURIComponent(
    `${window.location.origin}${window.location.pathname}${search}`,
  );
  (window as any).wx.miniProgram.redirectTo({
    url: `/webx-mp-next/transfer-station/index?type=login&back_url=${targetUrl}`,
  });
  return undefined;
}

async function loginQjWX(): Promise<undefined> {
  const query = getAllQuery(window.location.href);
  delete query.token;
  delete query.phone;
  delete query.uid;
  const search = qs.stringify(query, { arrayFormat: 'brackets', addQueryPrefix: true });
  const targetUrl = encodeURIComponent(
    `${window.location.origin}${window.location.pathname}${search}`,
  );
  (window as any).wx.miniProgram.postMessage({
    data: { type: 'action', method: 'login', params: { url: targetUrl } },
  });
  (window as any).wx.miniProgram.redirectTo({
    url: '/subpackages/commonProcess/loading/loading',
  });
  return undefined;
}

async function loginMy(): Promise<undefined> {
  const query = getAllQuery(window.location.href);
  delete query.token;
  delete query.phone;
  delete query.uid;
  const search = qs.stringify(query, { arrayFormat: 'brackets', addQueryPrefix: true });
  const targetUrl = encodeURIComponent(
    `${window.location.origin}${window.location.pathname}${search}`,
  );
  (window as any).my.redirectTo({
    url: `/webx-mp-next/transfer-station/index?type=login&back_url=${targetUrl}`,
  });
  return undefined;
}

async function loginPassenger(): Promise<UserInfo> {
  await passengerInit();
  return new Promise((resolve) => {
    (window as any).Fusion.requestLogin({}, (data: any) => {
      if (data && data.login_result === 0) {
        resolve({ login: true, ...data.userInfo });
      } else {
        resolve({ login: false });
      }
    });
  });
}

export const login = getMethodByEnv<() => Promise<undefined | UserInfo>>({
  wxmp: loginWX,
  alimp: loginMy,
  qjwxmp: loginQjWX,
  crwxmp: loginWX,
  passenger: loginPassenger,
  h5: loginH5,
});

export async function logout(): Promise<PassportLoginResult> {
  const passport = await getPassport();
  return new Promise((resolve) => {
    passport.logout(
      () => resolve({ login: false }),
      () => resolve({ login: true }),
    );
  });
}
