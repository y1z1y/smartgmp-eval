import type { AxiosResponse } from 'axios';

// ============================================================
// XEnv — 运行环境枚举
// ============================================================

export type XEnv =
  | 'wxmp'
  | 'alimp'
  | 'qjwxmp'
  | 'crwxmp'
  | 'passenger'
  | 'h5'
  | 'wxh5'
  | '';

// ============================================================
// 子模块类型
// ============================================================

export interface HtwSdkXenv {
  getEnv(): XEnv;
  getMethodByEnv<T>(config: Record<XEnv | string, T>): T;
  getQjChannel: number;
  getChannel: string;
  getAppType: string;
  init(): Promise<boolean>;
}

export interface HtwSdkUrl {
  getAllQuery(url: string): Record<string, string>;
  getSupportedImgSrc(src: string): string;
  genNewUrl(url: string): string;
}

export interface UserInfoSuccess {
  login: true;
  token: string;
  phone: string;
  uid: string;
}
export interface UserInfoFail {
  login: false;
  uid?: undefined;
  token?: undefined;
  phone?: undefined;
}
export type UserInfo = UserInfoSuccess | UserInfoFail;

export interface HtwSdkUser {
  getUserInfo(): Promise<UserInfo>;
  login(): Promise<UserInfo | undefined>;
  logout(): Promise<{ login: boolean }>;
}

export interface IGeolocation {
  success: boolean;
  latitude?: number;
  longitude?: number;
  cityId?: number;
}

export interface HtwSdkGeo {
  getCurrentPosition(): Promise<IGeolocation>;
  getCityId(latitude: number, longitude: number): Promise<number>;
}

export interface HtwSdkKop {
  send<T, P>(api: string, params: P): Promise<AxiosResponse<T>>;
  instance: any;
  http: any;
}

export interface OmegaConfig {
  appKey?: string;
  userId?: number;
  attrs: Record<string, string | number>;
}

export interface HtwSdkOmega {
  initOmegaDefaultAttrs(params?: Record<string, string>): Promise<undefined>;
  YKS_OMEGA_APP_KEY: string;
  getFromPage(): string;
}

export interface SubscribeParams {
  activityId: number | string;
  backUrl?: string;
}
export interface SubscribeWxParams {
  scene: string;
  pageImage: string;
  buttonImage: string;
  sourceChannel?: string;
}

export interface HtwSdkSubscribe {
  subscribe(config: SubscribeParams | SubscribeWxParams): void;
  subscribeWebx(config: SubscribeParams): Promise<void>;
}

export interface LinkConfig {
  wxmp: string;
  alimp: string;
  qjwxmp: string;
  crwxmp?: string;
  passenger: string;
}

export interface HtwSdkGoto {
  open(config: LinkConfig): Promise<{ success: boolean; msg?: string }>;
  close(): void;
  goto(config: { url: string; type: XEnv }): Promise<{ result: boolean; msg?: string }>;
  jumpToSpecialMiniApp(config: {
    activityId: string;
    backUrl: string;
  }): Promise<{ result: boolean; msg?: string }>;
}

export interface ShareParams {
  crwxmp?: any;
  poster?: any;
  moments?: any;
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

export interface HtwSdkShare {
  clickShare(config?: { url?: string }): Promise<void>;
  clickShareMoments(config?: { posterUrl?: string }): Promise<void>;
  clickSaveImage(config?: { posterUrl?: string }): Promise<void>;
  initShareInfo(params: ShareParams): void;
}

export interface DPayParams {
  outTradeId: string;
  codeOrigin?: string;
}

export interface HtwSdkPay {
  handlePay(params: DPayParams): Promise<boolean>;
}

export interface HtwSdkSetTitle {
  setPageTitle(title: string): void;
}

// ============================================================
// HtwSdk 聚合接口 — 与 mf-page/src/htw-sdk/index.ts 的导出一一对应
// ============================================================

export interface HtwSdk {
  xenv: HtwSdkXenv;
  url: HtwSdkUrl;
  user: HtwSdkUser;
  kop: HtwSdkKop;
  geo: HtwSdkGeo;
  omega: HtwSdkOmega;
  subscribe: HtwSdkSubscribe;
  goto: HtwSdkGoto;
  share: HtwSdkShare;
  pay: HtwSdkPay;
  setTitle: HtwSdkSetTitle;
  initWsgsdk(uid: string): Promise<void>;
}

// ============================================================
// Mock — 开发 / 测试 / SSR 兜底
// ============================================================

export const mockHtwSdk: HtwSdk = {
  xenv: {
    getEnv: () => 'h5' as const,
    getMethodByEnv: (c: any) => c.h5,
    getQjChannel: 99,
    getChannel: 'htw_wx_miniapp',
    getAppType: 'h5',
    init: async () => false,
  },
  url: {
    getAllQuery: () => ({}),
    getSupportedImgSrc: (src: string) => src,
    genNewUrl: (url: string) => url,
  },
  user: {
    getUserInfo: async () => ({ login: false }),
    login: async () => ({ login: false }),
    logout: async () => ({ login: false }),
  },
  kop: {
    send: async () => ({ data: { code: 0, data: undefined } }) as any,
    instance: null,
    http: null,
  },
  geo: {
    getCurrentPosition: async () => ({ success: false }),
    getCityId: async () => 0,
  },
  omega: {
    initOmegaDefaultAttrs: async () => undefined,
    YKS_OMEGA_APP_KEY: '',
    getFromPage: () => 'no_source_page',
  },
  subscribe: {
    subscribe: () => {},
    subscribeWebx: async () => {},
  },
  goto: {
    open: async () => ({ success: false, msg: 'mock' }),
    close: () => {},
    goto: async () => ({ result: false, msg: 'mock' }),
    jumpToSpecialMiniApp: async () => ({ result: false, msg: 'mock' }),
  },
  share: {
    clickShare: async () => {},
    clickShareMoments: async () => {},
    clickSaveImage: async () => {},
    initShareInfo: () => {},
  },
  pay: {
    handlePay: async () => false,
  },
  setTitle: {
    setPageTitle: (title: string) => {
      if (typeof document !== 'undefined') document.title = title;
    },
  },
  initWsgsdk: async () => {},
};

// ============================================================
// Window 全局类型扩充
// ============================================================

declare global {
  interface Window {
    htwSdk?: HtwSdk;
    __env__?: string;
    baseURL?: string;
    isSupportWebp?: boolean;
    Omega?: {
      setConfig: (config: OmegaConfig) => void;
      trackEvent: (
        name: string,
        desc?: string,
        attrs?: Record<string, unknown>,
      ) => void;
    };
    Fusion?: any;
    wx?: any;
    my?: any;
    __store__?: any;
    __atomMap__?: any;
    __mf_sdk__?: any;
  }
}

export {};
