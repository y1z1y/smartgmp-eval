import { PrimitiveAtom } from 'jotai';

export interface IGeolocation {
  success: boolean;
  latitude?: number;
  longitude?: number;
  cityId?: number;
}

export interface LinkConfig {
  wxmp: string;
  alimp: string;
  qjwxmp: string;
  passenger: string;
}

export interface TaskContentImages {
  taskContentOneImg: string;
  taskContentMoreImg: string;
}

export interface CyclingButtonImages {
  completedTwoImg: string;
  completedOneImg: string;
  incompleteTwoImg: string;
  incompleteOneImg: string;
}

export interface SkinConfigure {
  headImgUrl: string;
  headImgAuthUrl: string;
  rewardItemImgUrl: string;
  rewardDefaultImgUrl: string;
  rewardDoubleImgUrl: string;
}

export interface ButtonConfigure {
  close?: {
    buttonImg: string;
    buttonAuthImg: string;
  };
  subscribe?: {
    dialogSubscribeConfig: {
      scene: string;
      pageImage: string;
      buttonImage: string;
    };
    buttonImg: string;
    buttonAuthImg: string;
  };
  link?: {
    linkConfig: LinkConfig;
    buttonImg: string;
    buttonAuthImg: string;
  };
}

export interface QjCashbackProps {
  // 状态管理（可选，SmartGMP可能提供全局store）
  store?: any;
  atomMap?: {
    geolocationAtom: PrimitiveAtom<IGeolocation>;
    seriesTaskInfoAtom: PrimitiveAtom<any>;
  };

  // 图片配置（有 meta 默认值，可省略）
  bannerimg?: string;
  arrowimg?: string;
  taskcontent?: TaskContentImages;
  cyclingbtnimage?: CyclingButtonImages;

  // 链接配置（默认空链接）
  cyclingincompletelink?: LinkConfig;
  cyclingcompletedlink?: LinkConfig;

  // 其他配置（可选）
  reminddata?: object;
  status?: Record<string, string>;
  skinConfigure?: SkinConfigure;
  buttonConfigure?: ButtonConfigure;
  subscribeConfig?: object;
  previewVisible?: boolean;
  priority?: number;
  __designMode?: string;

  // API配置（可选）
  apiConfig?: {
    baseUrl?: string;
    headers?: Record<string, string>;
  };

  // Mock数据（可选，用于测试）
  mockData?: {
    taskList?: any[];
    taskCenter?: any;
    award?: any;
  };
}
