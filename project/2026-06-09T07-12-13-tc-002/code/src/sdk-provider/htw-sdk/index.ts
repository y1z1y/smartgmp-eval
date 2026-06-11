import { initWsgsdk } from './wsgsdk';
import * as url from './url';
import * as user from './user';
import * as kop from './kop';
import * as geo from './geo';
import * as xenv from './xenv';
import * as omega from './omega';
import * as subscribe from './subscribe';
import * as goto from './goto';
import * as share from './share';
import * as setTitle from './setPageConfig';
import * as pay from './pay';
import type { HtwSdk } from '../sdk';

export { xenv, initWsgsdk, url, user, geo, kop, omega, subscribe, goto, share, pay, setTitle };

export const builtinHtwSdk: HtwSdk = {
  xenv: {
    getEnv: xenv.getEnv,
    getMethodByEnv: xenv.getMethodByEnv,
    getQjChannel: xenv.getQjChannel,
    getChannel: xenv.getChannel,
    getAppType: xenv.getAppType,
    init: xenv.init,
  },
  url: {
    getAllQuery: url.getAllQuery,
    getSupportedImgSrc: url.getSupportedImgSrc,
    genNewUrl: url.genNewUrl,
  },
  user: {
    getUserInfo: user.getUserInfo,
    login: user.login,
    logout: user.logout,
  },
  kop: {
    send: kop.send,
    instance: kop.instance,
    http: kop.http,
  },
  geo: {
    getCurrentPosition: geo.getCurrentPosition,
    getCityId: geo.getCityId,
  },
  omega: {
    initOmegaDefaultAttrs: omega.initOmegaDefaultAttrs,
    YKS_OMEGA_APP_KEY: omega.YKS_OMEGA_APP_KEY,
    getFromPage: omega.getFromPage,
  },
  subscribe: {
    subscribe: subscribe.subscribe,
    subscribeWebx: subscribe.subscribeWebx,
  },
  goto: {
    open: goto.open,
    close: goto.close,
    goto: goto.goto,
    jumpToSpecialMiniApp: goto.jumpToSpecialMiniApp,
  },
  share: {
    clickShare: share.clickShare,
    clickShareMoments: share.clickShareMoments,
    clickSaveImage: share.clickSaveImage,
    initShareInfo: share.initShareInfo,
  },
  pay: {
    handlePay: pay.handlePay,
  },
  setTitle: {
    setPageTitle: setTitle.setPageTitle,
  },
  initWsgsdk,
};
