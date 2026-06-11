import { MyResponseInner } from './interface';
import { kopCall } from '../../sdk-provider';

type QueryTaskCenterListParams = {
  bizId: string;
  campaignId: string;
  channelId: string;
  longitude: number;
  latitude: number;
  cityId: number;
};

export type TaskConfig = {
  subTaskConfigs: {
    taskName: string;
    taskId: number;
  }[];
  beginTime: number;
  endTime: number;
  showDoubleImage: boolean;
  title: string;
  awardText: string;
};
export function queryTaskCenterList(data: QueryTaskCenterListParams) {
  return kopCall<MyResponseInner<{ groupTaskConfigs: TaskConfig[] }>>(
    'prado.fission.ComponentCampaignFacade.queryTaskCenterList', data,
  );
}

type QueryTaskListParams = {
  taskIds: string;
  lng: number;
  lat: number;
  cityId: number;
};

export type SubTaskResult = {
  status: number;
  taskButton?: string;
  taskSeq: number;
  progressRate: {
    totalValue: number;
    currentValue: number;
  };
  taskManualRightDTO?: {
    rightTypeList?: string[];
    rightName?: string;
    isSingleRedpacket: boolean;
    batchId?: number;
    originPrice?: string;
    multipleNum?: number;
    price?: string;
    /**
     * 如果为true，标识是奖励【手动领奖型任务|访问过活动自动下发】 且没有过领取动作
     */
    getRightReceiveFlag?: boolean;
  };
  subTaskPic: string;
  subTitle: string;
  taskUrl: string;
  mainTitle: string;
  end: number;
  id: number;
  taskInstructions: string;
  begin: number;
};
export type MainTaskResult = {
  id: number;
  issuedAward?: string;
  multipleNum?: number;
  subTaskResultList: SubTaskResult[];
  isMultipleTask: boolean;
  periodBeginTime: number;
  beginTime: number;
  taskCampaignId: number;
  taskSceneType: number;
  taskType: number;
  subTitle: string;
  bizId: string;
  eventNameList: string[];
  periodEndTime: number;
  categoryCode: string;
  priority: number;
  taskWay: number;
  multipleAward: {
    awardDetail: {
      isSingleRedpacket: boolean;
      subTaskId: number;
    }[];
  };
  mainTitle: string;
  originTaskType: number;
  taskPeriod: number;
  endTime: number;
  teamType: number;
  status: number;
};
export function queryTaskList(data: QueryTaskListParams) {
  return kopCall<MainTaskResult[]>(
    'prd.task.going.specified.task.list.query', data,
  );
}

type TaskReceiveParams = {
  taskId: number;
  cityId: number;
};

export function taskReceive(data: TaskReceiveParams) {
  return kopCall<boolean>('prd.task.receive', data);
}

export type TaskReceiveAwardParams = {
  /**
   * 活动id，取值任务查询中返回的taskCampaignId字段
   */
  campaignId: number;
  /**
   * 子任务id，取值任务查询返回的
   */
  subTaskId: number;
  /**
   * 子任务开始时间 取查询列表的periodBeginTime
   */
  beginTime: number;
  /**
   * 子任务结束时间 取查询列表的periodEndTime
   */
  endTime: number;
};

type SubBenefitInfoGrantResults = {
  /**
   * 前端添加字段
   */
  isPackage?: boolean;
  batchName: string;
  benefitType: number;
  status: number;
  benefitEffectiveTime?: number;
  couponType?: number;
  couponMaxAmount?: number;
  limitType?: number;
  limitAmount?: number;
  multiple?: number;
  cyclingCashAmount?: number;
  redEnvelopmentAmount?: number;
  ecomVoucherInfo?: {
    minUsePrice?: string;
    type?: number;
    discountValue?: string;
    priceValue?: string;
  };
  discount?: number;
  benefitName?: string;
  benefitDesc?: string;
  batchDesc?: string;
  payMisProductId?: number;
  productId?: number;
  batchId?: number;
  commonBenefitId?: string;
  // benefitInvalidTime: 1716998400000;
  // code: 0;
  // couponId: '2719f3f9d2b29b00';
  // useCondition: '年盘电单订单折扣券-第三行文案';
};

export type BenefitResult = {
  /**
   * 前端添加字段
   */
  isPackage?: boolean;
  subBenefitInfoGrantResults?: SubBenefitInfoGrantResults[];
  batchName: string;
  /**
   * todo，后续改成枚举
   */
  benefitType: number;
  status: number;
  commonAttributes?: string;
  discountRule?: string;
  consumeRule?: string;
  benefitEffectiveTime?: number;
  couponType?: number;
  couponMaxAmount?: number;
  limitType?: number;
  limitAmount?: number;
  multiple?: number;
  cyclingCashAmount?: number;
  redEnvelopmentAmount?: number;
  ecomVoucherInfo?: {
    minUsePrice?: string;
    type?: number;
    discountValue?: string;
    priceValue?: string;
  };
  discount?: number;
  cardResult?: {
    cardConfigDay?: number;
    remainTimes?: number;
    cardAmount?: number;
    favorType?: number;
  };
  benefitName?: string;
  benefitDesc?: string;
  batchDesc?: string;
  payMisProductId?: number;
  productId?: number;
  batchId?: number;
  commonBenefitId?: string;
  // benefitInvalidTime: 1680192000000;
  // code: 0;
};

type TaskManualRightDTO = {
  rightTypeList?: string[];
  getRightReceiveFlag?: boolean;
  rightName?: string;
  benefitResult: BenefitResult[];
};
export function taskReceiveAward(data: TaskReceiveAwardParams) {
  return kopCall<{ code: number; taskManualRightDTO: TaskManualRightDTO }>(
    'prd.task.receive.award', data,
  );
}

type QueryAwardPopupWindowParams = {
  bizId: string;
  campaignId: string;
  channelId: string;
  longitude: number;
  latitude: number;
  cityId: number;
  /**
   * 是否骑行返现活动
   */
  checkTaskCenter: boolean;
};

export function queryAwardPopupWindow(data: QueryAwardPopupWindowParams) {
  return kopCall<MyResponseInner<{ benefitResult: BenefitResult[] }>>(
    'prado.fission.ComponentCampaignFacade.queryAwardPopupWindow', data,
  );
}

export interface AuthReceiveParams {
  campaignId: string;
  benefitConsumeInfoListStr: string;
}
type AuthReceiveItem = {
  subTaskIndex?: number;
  periodBeginTime?: number;
  periodEndTime?: number;
  benefitResult: BenefitResult[];
};
export function authReceive(data: AuthReceiveParams) {
  return kopCall<MyResponseInner<AuthReceiveItem[]>>(
    'prado.fission.EcomAuthReceiveFacade.authReceive', data,
  );
}
