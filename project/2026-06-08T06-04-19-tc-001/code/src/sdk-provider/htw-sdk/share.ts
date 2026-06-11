import { getEnv, getMethodByEnv } from './xenv';
import { getAllQuery } from './url';
import qs from 'qs';
import { diffParamsForTrack } from './error-track';

let buildWebxJsWeb: ((path: string, params: Record<string, any>) => string) | null = null;

try {
  // @ts-ignore optional dependency — only used in crwxmp
  const webxJsWeb = require('@didi/webx-js-web');
  buildWebxJsWeb = webxJsWeb.build;
} catch {
  // @didi/webx-js-web not available — crwxmp share will use fallback
}

let initShareData: any = {};

interface PassengerShareParams {
  title: string;
  icon: string;
  url: string;
}

interface InitWxMiniappShareParams {
  title: string;
  path: string;
  imageUrl: string;
}

interface CrWxmpShareParams {
  inviterId?: string | number;
  campaignId?: string;
}

interface InitCrWxmpShareParams {
  disableShare: boolean;
  title: string;
  jumpLinkUrl: string;
  imageUrl: string;
  middlePageId?: string | number;
  posterTitle?: string;
  posterSubTitle?: string;
  inviterId?: string | number;
  campaignId?: string;
  campaignSource?: string;
}

interface InitCrPosterParams {
  disableShare?: boolean;
  imageUrl?: string;
  text?: string;
  title?: string;
  backgroundImage?: string;
}

interface InitCrWxMomentsParams {
  disableShare?: boolean;
  title: string;
  posterSubTitle?: string;
  imageUrl: string;
}

export interface ShareParams {
  crwxmp?: InitCrWxmpShareParams;
  poster?: InitCrPosterParams;
  moments?: InitCrWxMomentsParams;
  applet: {
    disableShare: boolean;
    title: string;
    jumpLinkUrl: string;
    imageUrl: string;
    middlePageId?: string | number;
    posterTitle?: string;
    posterSubTitle?: string;
  };
  didiApplet: {
    disableShare: boolean;
    title: string;
    jumpLinkUrl: string;
    imageUrl: string;
    middlePageId?: string | number;
  };
  aliPay: {
    disableShare: boolean;
    backgroundPicUrl: string;
    customizeText: string;
    describe: string;
    guidePicUrl: string;
    shareIcon: string;
    title: string;
  };
  link: {
    disableShare: boolean;
    imageUrl: string;
    subTitle: string;
    title: string;
  };
}

export enum MiniProgramType {
  PROD = 0,
  DEV = 1,
  PRE = 2,
}

const QJWXMP_SHARE_PATH = '/subpackages/commonProcess/blank/blank?url=';
const DIDI_SHARE_PATH = '/qingju/subpackages/commonProcess/blank/blank?url=';
const DIDI_WEBVIEW_SHARE_PATH = '/homepage/pages/index?targetH5Url=';
const APPID = 'gh_7a5c4141778f';
const isPro =
  typeof location !== 'undefined' && location.href.includes('page.xiaojukeji.com');
const MINI_PROGRAM_TYPE = isPro ? MiniProgramType.PROD : MiniProgramType.PRE;

const initSharePath = () => {
  const { campaignId, bizId, ddchn = '' } = getAllQuery(window.location.href);
  return `${window.location.origin}${window.location.pathname}?campaignId=${campaignId}&bizId=${bizId}&needLogin=true&ddchn=${ddchn}&channelId=${ddchn}&action=share`;
};

async function alimpShare(config: { url?: string } = {}): Promise<void> {
  const { aliPay } = initShareData;
  const { backgroundPicUrl, customizeText, describe, disableShare, shareIcon, title } = aliPay;
  if (disableShare) return;
  diffParamsForTrack('alimpShare', aliPay, [
    'title', 'backgroundPicUrl', 'describe', 'customizeText', 'shareIcon',
  ]);
  if (!title) return;
  const url = config?.url || initSharePath();
  const path = `${DIDI_SHARE_PATH}${encodeURIComponent(url)}`;
  const { xenv = '' } = getAllQuery(window.location.href);
  const shareData: any = {
    data: {
      title,
      desc: describe,
      content: customizeText,
      bgImgUrl: backgroundPicUrl.includes('https') ? backgroundPicUrl : `https:${backgroundPicUrl}`,
      path,
      imageUrl: shareIcon.includes('https') ? shareIcon : `https:${shareIcon}`,
    },
  };
  if (xenv === 'alimp') {
    shareData.type = 'share';
    shareData.data.url = url;
    shareData.data.mpPath = path;
  }
  (window as any).my?.postMessage(shareData);
}

async function webxShare(config: { url?: string } = {}): Promise<void> {
  const { didiApplet, applet } = initShareData;
  const env = getEnv();
  const shareConfig = env === 'wxmp' ? didiApplet : applet;
  const path = env === 'wxmp' ? DIDI_SHARE_PATH : QJWXMP_SHARE_PATH;
  if (shareConfig.disableShare) return;
  diffParamsForTrack('webxShare', shareConfig, ['title', 'imageUrl', 'middlePageId']);
  const param = {
    type: 'share',
    activity_id: shareConfig?.middlePageId,
    share_shareTitle: shareConfig.title,
    share_shareImgUrl: encodeURIComponent(
      shareConfig.imageUrl.includes('https') ? shareConfig.imageUrl : `https:${shareConfig.imageUrl}`,
    ),
    share_sharePath: encodeURIComponent(
      `${path}${encodeURIComponent(config?.url || shareConfig?.jumpLinkUrl || initSharePath())}`,
    ),
  };
  const finallyParams = qs.stringify(param, {
    arrayFormat: 'brackets', addQueryPrefix: false, encode: false,
  });
  const url = `/webx-mp-next/transfer-station/index?${finallyParams}`;
  (window as any).wx?.miniProgram?.navigateTo({ url });
}

async function passengerShare(config: { url?: string } = {}): Promise<void> {
  const Fusion = (window as any).Fusion;
  if (!Fusion) return;
  const { didiApplet } = initShareData;
  const { title, imageUrl, disableShare, jumpLinkUrl } = didiApplet;
  const jumpUrl = config?.url || jumpLinkUrl || initSharePath();
  if (disableShare) return;
  diffParamsForTrack('passengerShare', didiApplet, ['imageUrl', 'jumpUrl']);
  const path = `${DIDI_SHARE_PATH}${encodeURIComponent(jumpUrl)}`;
  const initShareMethod = Fusion.initShareEntrance || Fusion.initEntrance;
  const invokeShareMethod = Fusion.invokeShareEntrance || Fusion.invokeEntrance;
  initShareMethod({
    buttons: [
      {
        type: 'shareWeixinAppmsg',
        data: {
          type: 'miniApp',
          title,
          icon: imageUrl.includes('https') ? imageUrl : `https:${imageUrl}`,
          url: jumpUrl,
          ext: { appId: APPID, path },
        },
      },
    ],
    clickCallBack: '__mofang_share_click_call_back',
  });
  invokeShareMethod();
}

async function emptyShare(): Promise<void> {
  console.log('当前环境无分享能力');
}

async function initPassengerShare(config: PassengerShareParams): Promise<void> {
  const Fusion = (window as any).Fusion;
  if (!Fusion) return;
  const { title, icon } = config;
  let { url } = config;
  if (!url) url = initSharePath();
  diffParamsForTrack('initPassengerShare', config, ['icon']);
  const path = `${DIDI_SHARE_PATH}${encodeURIComponent(url)}`;
  const initShareMethod = Fusion.initShareEntrance || Fusion.initEntrance;
  initShareMethod({
    buttons: [
      {
        type: 'shareWeixinAppmsg',
        data: {
          type: 'miniApp',
          title,
          icon: icon.includes('https') ? icon : `https:${icon}`,
          url,
          ext: { appId: APPID, path },
        },
      },
    ],
  });
}

async function initQJminiappShare(config: InitWxMiniappShareParams): Promise<void> {
  const { title, imageUrl } = config;
  diffParamsForTrack('initQJminiappShare', config, ['imageUrl', 'title']);
  let { path } = config;
  if (!path) path = initSharePath();
  const setData = {
    title,
    path: `${QJWXMP_SHARE_PATH}${encodeURIComponent(path)}`,
    imageUrl: imageUrl.includes('https') ? imageUrl : `https:${imageUrl}`,
  };
  (window as any).wx?.miniProgram?.postMessage({ data: setData });
}

async function initWxminiappShare(config: InitWxMiniappShareParams): Promise<void> {
  diffParamsForTrack('initWxminiappShare', config, ['title', 'imageUrl']);
  const { title, imageUrl } = config;
  let { path } = config;
  if (!path) path = initSharePath();
  const data = {
    data: {
      type: 'share',
      data: {
        title,
        url: path,
        mpPath: `${DIDI_WEBVIEW_SHARE_PATH}${encodeURIComponent(path)}`,
        imageUrl: imageUrl.includes('https') ? imageUrl : `https:${imageUrl}`,
      },
    },
  };
  (window as any).wx?.miniProgram?.postMessage(data);
}

const initCrWxmpShare = (config: InitCrWxmpShareParams): void => {
  diffParamsForTrack('initCrWxmpShare', config, ['title', 'imageUrl']);
  const { title, imageUrl, jumpLinkUrl } = config;
  const dchn = jumpLinkUrl.split('/').pop() || '';
  let path = `/pages/index/index?p=ut-car-rental&scene=${dchn}&token=__token__`;
  if (buildWebxJsWeb) {
    path = buildWebxJsWeb('/pages/index/index?p=ut-car-rental', {
      scene: dchn,
      token: '__token__',
    });
  }
  const data = {
    data: {
      type: 'share',
      data: {
        title,
        mpPath: path,
        imageUrl: imageUrl.includes('https') ? imageUrl : `https:${imageUrl}`,
      },
    },
  };
  (window as any).wx?.miniProgram?.postMessage(data);
};

const invokeCrWxmpShare = (config: InitCrWxmpShareParams): void => {
  const { title, imageUrl, jumpLinkUrl, middlePageId, inviterId, campaignId, campaignSource } = config;
  const dchn = jumpLinkUrl?.split('/').pop() || '';
  let path = `/pages/index/index?p=ut-car-rental&scene=${dchn}&token=__token__`;
  if (buildWebxJsWeb) {
    path = buildWebxJsWeb('/pages/index/index?p=ut-car-rental', {
      inviterId, campaignId, campaignSource, scene: dchn, token: '__token__',
    });
  }
  const param = {
    type: 'share',
    activity_id: middlePageId,
    share_title: title,
    share_imgUrl: encodeURIComponent(
      imageUrl.includes('https') ? imageUrl : `https:${imageUrl}`,
    ),
    share_shareTitle: title,
    share_shareImgUrl: encodeURIComponent(
      imageUrl.includes('https') ? imageUrl : `https:${imageUrl}`,
    ),
    share_sharePath: encodeURIComponent(path),
    share_share_group_btn_text: title,
    miniprogram_type: MINI_PROGRAM_TYPE,
  };
  const finallyParams = qs.stringify(param, {
    arrayFormat: 'brackets', addQueryPrefix: false, encode: false,
  });
  const url = `/webx-mp-next/transfer-station/index?${finallyParams}`;
  (window as any).wx?.miniProgram?.navigateTo({ url });
};

async function crWxmpClickShare(config: CrWxmpShareParams = {}): Promise<void> {
  const params = initShareData as ShareParams;
  const block = params.crwxmp ?? params.applet;
  if (!block || block.disableShare) return;
  const jumpLinkUrl = block.jumpLinkUrl || initSharePath();
  const shareConfig: InitCrWxmpShareParams = {
    disableShare: block.disableShare,
    title: block.title,
    jumpLinkUrl,
    imageUrl: block.imageUrl,
    middlePageId: block.middlePageId,
    ...config,
  };
  invokeCrWxmpShare(shareConfig);
}

export const clickShare = getMethodByEnv({
  wxmp: webxShare,
  crwxmp: crWxmpClickShare,
  alimp: alimpShare,
  qjwxmp: webxShare,
  passenger: passengerShare,
  h5: emptyShare,
});

export const initShareInfo = (params: ShareParams) => {
  const { applet, didiApplet, aliPay, crwxmp } = params;
  initShareData = params;

  const isEnv = getEnv();
  const { env = '', xenv = '' } = getAllQuery(window.location.href);
  if ((isEnv === 'qjwxmp' || env === 'didi') && applet?.disableShare === false) {
    const { title = '', jumpLinkUrl = '', imageUrl = '' } = applet;
    initQJminiappShare({ title, path: jumpLinkUrl, imageUrl });
  } else if (isEnv === 'crwxmp' && crwxmp?.disableShare === false) {
    initCrWxmpShare(crwxmp);
  } else if (isEnv === 'wxmp' && xenv === 'wxmp' && didiApplet?.disableShare === false) {
    const { title = '', jumpLinkUrl = '', imageUrl = '' } = didiApplet;
    initWxminiappShare({ title, path: jumpLinkUrl, imageUrl });
  } else if (isEnv === 'passenger' && didiApplet?.disableShare === false) {
    const { title = '', jumpLinkUrl = '', imageUrl = '' } = didiApplet;
    initPassengerShare({ title, url: jumpLinkUrl, icon: imageUrl });
  } else if (isEnv === 'alimp' && aliPay?.disableShare === false) {
    alimpShare();
  } else if (isEnv === 'wxh5') {
    if (!params.link || params.link.disableShare) return;
    const { title, imageUrl, subTitle } = params.link;
    (window as any).wx?.ready(() => {
      (window as any).wx?.updateAppMessageShareData({
        title,
        desc: subTitle,
        link: window.location.href,
        imgUrl: imageUrl.startsWith('http') ? imageUrl : `https:${imageUrl}`,
        success() {},
      });
    });
  }
};

export async function crWxmpClickMoments(config: { posterUrl?: string } = {}): Promise<void> {
  const params = initShareData as ShareParams;
  const block = params.moments ?? params.applet;
  const param = {
    type: 'share',
    poster_image_url: encodeURIComponent(config.posterUrl || ''),
    poster_title: block?.title || '',
    poster_btn_text: '朋友圈',
    poster_btn_image: 'https://ut-static.udache.com/webx/yingkesong/9fsK9PmqONl6asbmpEz5Z.png',
  };
  const finallyParams = qs.stringify(param, {
    arrayFormat: 'brackets', addQueryPrefix: false, encode: false,
  });
  const url = `/webx-mp-next/transfer-station/index?${finallyParams}`;
  (window as any).wx?.miniProgram?.navigateTo({ url });
}

export const clickShareMoments = getMethodByEnv({
  wxmp: emptyShare,
  crwxmp: crWxmpClickMoments,
  qjwxmp: emptyShare,
  alimp: emptyShare,
  passenger: emptyShare,
  h5: emptyShare,
});

export async function crWxmpClickSaveImage(config: { posterUrl?: string } = {}): Promise<void> {
  const params = initShareData as ShareParams;
  const block = params.poster;
  const param = {
    type: 'share',
    poster_image_url: encodeURIComponent(config.posterUrl || ''),
    poster_title: (block as any)?.title || (block as any)?.text || '',
    poster_btn_text: '保存图片',
    poster_btn_image: 'https://ut-static.udache.com/webx/yingkesong/WQZzlNKAQLBzF1HVqaeHi.png',
  };
  const finallyParams = qs.stringify(param, {
    arrayFormat: 'brackets', addQueryPrefix: false, encode: false,
  });
  const url = `/webx-mp-next/transfer-station/index?${finallyParams}`;
  (window as any).wx?.miniProgram?.navigateTo({ url });
}

export const clickSaveImage = getMethodByEnv({
  wxmp: emptyShare,
  crwxmp: crWxmpClickSaveImage,
  qjwxmp: emptyShare,
  alimp: emptyShare,
  passenger: emptyShare,
  h5: emptyShare,
});
