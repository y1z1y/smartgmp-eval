import { getEnv, getMethodByEnv, XEnv } from './xenv';
import { diffParamsForTrack, trackForParamsError } from './error-track';

interface JumpParams {
  url: string;
  type: XEnv;
}

interface ToOtherMiniApp {
  activityId: string;
  backUrl: string;
}

interface NavigateToMiniProgram {
  activity_id: string;
  back_url: string;
  aliAppId: string;
  passengerAppId: string;
  path: string;
  query: string;
}

interface JumpFail {
  result: boolean;
  msg: string;
}
interface JumpSuccess {
  result: boolean;
}
export type JumpInfo = JumpSuccess | JumpFail;

async function jumpToApp(config: JumpParams): Promise<JumpInfo> {
  diffParamsForTrack('jumpToApp', config, ['url']);
  return new Promise((resolve) => {
    if (config.url) {
      const env = getEnv();
      if ((window as any).Fusion && env === 'passenger') {
        (window as any).Fusion.openPage(
          { url: config.url },
          (res: any) => {
            resolve({ result: true });
          },
        );
      } else {
        resolve({ result: false, msg: '无法执行端内跳转' });
      }
    } else {
      resolve({ result: false, msg: '[端上跳转失败]缺少跳转url' });
    }
  });
}

async function jumpToH5(config: JumpParams): Promise<JumpInfo> {
  diffParamsForTrack('jumpToH5', config, ['url']);
  return new Promise((resolve) => {
    if (config.url) {
      window.location.href = config.url;
      resolve({ result: true });
    } else {
      resolve({ result: false, msg: '缺少跳转url' });
    }
  });
}

async function jumpToMiniApp(config: JumpParams): Promise<JumpInfo> {
  diffParamsForTrack('jumpToMiniApp', config, ['url']);
  return new Promise((resolve) => {
    if (config.url) {
      const env = getEnv();
      if (env === 'alimp') {
        (window as any).my?.navigateTo({ url: config.url });
        resolve({ result: true });
      } else if (env === 'wxmp' || env === 'qjwxmp' || env === 'crwxmp') {
        (window as any).wx?.miniProgram?.navigateTo({ url: config.url });
        resolve({ result: true });
      } else {
        resolve({ result: false, msg: '当前容器不支持跳转此方法' });
      }
    } else {
      resolve({ result: false, msg: '缺少跳转url' });
    }
  });
}

export const goto = (config: JumpParams) => {
  const env = config.type;
  switch (env) {
    case 'wxmp':
    case 'alimp':
    case 'qjwxmp':
    case 'crwxmp':
      return jumpToMiniApp(config);
    case 'passenger':
      return jumpToApp(config);
    case 'h5':
    default:
      return jumpToH5(config);
  }
};

export async function jumpToSpecialMiniApp(config: ToOtherMiniApp): Promise<JumpInfo> {
  diffParamsForTrack('jumpToSpecialMiniApp', config, ['activityId', 'backUrl']);
  return new Promise((resolve) => {
    const { activityId, backUrl } = config;
    const env = getEnv();
    if (activityId && backUrl) {
      if (env === 'wxmp' || env === 'qjwxmp' || env === 'crwxmp') {
        (window as any).wx?.miniProgram?.redirectTo({
          url: `/webx-mp-next/transfer-station/index?type=jump&activity_id=${activityId}&back_url=${backUrl}`,
        });
        resolve({ result: true });
      } else if (env === 'alimp') {
        (window as any).my?.redirectTo({
          url: `/webx-mp-next/transfer-station/index?type=jump&activity_id=${activityId}&back_url=${backUrl}`,
        });
        resolve({ result: true });
      } else {
        resolve({ result: false, msg: '当前环境不支持执行该方法' });
      }
    } else {
      resolve({ result: false, msg: '缺少配置，请到业务工作台-微信平台-中间页配置查看是否配置' });
    }
  });
}

export interface LinkConfig {
  wxmp: string;
  alimp: string;
  qjwxmp: string;
  crwxmp?: string;
  passenger: string;
}

export const DIDI_BLANK_PATH = '/qingju/subpackages/commonProcess/blank/blank?url=';
export const HTW_BLANK_PATH = '/subpackages/commonProcess/blank/blank?url=';

const homeUrl: Record<string, string> = {
  wxmp: '/qingju/pages/init/init',
  alimp: '/qingju/pages/init/init',
  qjwxmp: '/pages/init/init',
  crwxmp: '/pages/init/init',
  passenger: 'OneTravel://bike/entrance',
  h5: '',
};

export async function open(config: LinkConfig): Promise<{ success: boolean; msg?: string }> {
  switch (getEnv()) {
    case 'wxmp': {
      let url = config.wxmp || config.passenger;
      if (url === undefined || url === '') {
        trackForParamsError('open', 'wxmp || passenger', config);
        return { success: false, msg: 'url 为空' };
      }
      if (url === 'home') {
        url = homeUrl.wxmp;
      } else if (url === '#/prize') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.append('pageIndex', '1');
        url = newUrl.toString();
      }
      if (url.indexOf('http') === 0) {
        url = `${DIDI_BLANK_PATH}${encodeURIComponent(url)}`;
      }
      try {
        const page = await (window as any).wx.miniProgram.navigateTo({ url });
        return { success: true, ...page };
      } catch (e) {
        return { success: false, msg: `${e}` };
      }
    }
    case 'alimp': {
      let url = config.alimp || config.passenger;
      if (url === undefined || url === '') {
        trackForParamsError('open', 'alimp || passenger', config);
        return { success: false, msg: 'url 为空' };
      }
      if (url === 'home') {
        url = homeUrl.alimp;
      } else if (url === '#/prize') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.append('pageIndex', '1');
        url = newUrl.toString();
      }
      if (url.indexOf('http') === 0) {
        url = `${DIDI_BLANK_PATH}${encodeURIComponent(url)}`;
      }
      return new Promise((resolve) => {
        (window as any).my.navigateTo({
          url,
          success: () => resolve({ success: true }),
          fail: ({ errorMessage }: { errorMessage: string }) =>
            resolve({ success: false, msg: errorMessage }),
        });
      });
    }
    case 'crwxmp': {
      let url = config.crwxmp || config.passenger;
      if (url === undefined || url === '') {
        trackForParamsError('open', 'crwxmp', config);
        return { success: false, msg: 'url 为空' };
      }
      try {
        const page = await (window as any).wx.miniProgram.navigateTo({ url });
        return { success: true, ...page };
      } catch (e) {
        return { success: false, msg: `${e}` };
      }
    }
    case 'qjwxmp': {
      let url = config.qjwxmp || config.passenger;
      if (url === undefined || url === '') {
        trackForParamsError('open', 'qjwxmp || passenger', config);
        return { success: false, msg: 'url 为空' };
      }
      if (url === 'home') {
        url = homeUrl.qjwxmp;
      } else if (url === '#/prize') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.append('pageIndex', '1');
        url = newUrl.toString();
      }
      if (url.indexOf('http') === 0) {
        url = `${HTW_BLANK_PATH}${encodeURIComponent(url)}`;
      }
      try {
        const page = await (window as any).wx.miniProgram.navigateTo({ url });
        return { success: true, ...page };
      } catch (e) {
        return { success: false, msg: `${e}` };
      }
    }
    case 'passenger': {
      let url = config.passenger;
      if (url === undefined || url === '') {
        trackForParamsError('open', 'passenger', config);
        return { success: false, msg: 'url 为空' };
      }
      if (url === 'home') {
        url = homeUrl.passenger;
      } else if (url === '#/prize') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.append('pageIndex', '1');
        url = newUrl.toString();
      }
      return new Promise((resolve) => {
        (window as any).Fusion.openPage({ url }, (res: any) => {
          resolve({ success: true, ...res });
        });
      });
    }
    case 'h5':
    default: {
      const url = config.passenger;
      if (url === '#/prize') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.append('pageIndex', '1');
        window.location.href = newUrl.toString();
      } else if (url && url.indexOf('http') === 0) {
        window.location.href = url;
      }
      return { success: false, msg: 'h5不支持' };
    }
  }
}

export const close = getMethodByEnv({
  wxmp: () => {},
  alimp: () => {},
  qjwxmp: () => {},
  crwxmp: () => {},
  passenger: () => {
    (window as any).Fusion?.closePage({}, () => {});
  },
  h5: () => {},
});

async function jumpToSpecialMiniAppByWx(params: NavigateToMiniProgram): Promise<JumpInfo> {
  return new Promise((resolve) => {
    const { activity_id } = params;
    if (activity_id) {
      (window as any).wx?.miniProgram?.navigateTo({
        url: `/webx-mp-next/transfer-station/index?type=jump&activity_id=${activity_id}&back_url=`,
      });
      resolve({ result: true });
      return;
    }
    resolve({ result: false, msg: 'jumpToSpecialMiniAppByWx 参数缺失' });
  });
}

async function jumpToSpecialMiniAppByAli(params: NavigateToMiniProgram): Promise<JumpInfo> {
  return new Promise((resolve) => {
    const { aliAppId, path = '', query = '' } = params;
    if (aliAppId) {
      window.location.href = `alipays://platformapi/startapp?appId=${aliAppId}&page=${path}&query=${encodeURIComponent(query)}`;
      resolve({ result: true });
      return;
    }
    resolve({ result: false, msg: 'jumpToSpecialMiniAppByAli 参数缺失' });
  });
}

async function jumpToSpecialMiniAppByPassenger(params: NavigateToMiniProgram): Promise<JumpInfo> {
  return new Promise((resolve) => {
    const { passengerAppId, path = '', query = '' } = params;
    if (passengerAppId) {
      (window as any).Fusion?.launchWeChatMiniApp({
        appId: passengerAppId,
        path: query ? `${path}?${query}` : path,
      });
      resolve({ result: true });
      return;
    }
    resolve({ result: false, msg: 'jumpToSpecialMiniAppByPassenger 参数缺失' });
  });
}

async function jumpToSpecialMiniAppByH5(): Promise<JumpInfo> {
  return Promise.resolve({ result: false, msg: '当前环境不支持该方法' });
}

export const gotoSpecialMiniApp = getMethodByEnv({
  wxmp: jumpToSpecialMiniAppByWx,
  alimp: jumpToSpecialMiniAppByAli,
  qjwxmp: jumpToSpecialMiniAppByWx,
  crwxmp: jumpToSpecialMiniAppByWx,
  passenger: jumpToSpecialMiniAppByPassenger,
  h5: jumpToSpecialMiniAppByH5,
});
