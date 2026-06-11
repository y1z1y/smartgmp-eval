export type {
  XEnv,
  LinkConfig,
  IGeolocation,
  UserInfo,
} from '../../sdk-provider';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export interface MyResponseInner<T> {
  code: number;
  success: boolean;
  result: T;
}
export interface CommonAttributes {
  consumeArea?: '0';
  consumePeriodType?: 1;
  couponMaxAmount?: 150;
  couponType?: number;
  payMisProductId?: 251;
  remainBatchNumber?: 6664;
  remainBudget?: 9997;
  remainBudgetCent?: 999700;
  remark?: '电-其一-开19关21005方案';
  ruleAdditionRemark?: '';
}
export interface DiscountRule {
  promotionMethod?: {
    amount: 150;
    maxAmount: 150;
    promotionMethodType: 2;
    ruleDescription: '核销优惠方式：每单可抵1.50元';
    discount?: number;
  };
}
export interface ConsumeRule {
  consumeTime?: {
    ruleDescription: '可核销时间段：周一、周二、周三、周四、周五、周六、周日，全天可用';
    weekdays: ['1', '2', '3', '4', '5', '6', '7'];
  };
  couponConsumeFence?: {
    endFenceIds: ['21005', '18006'];
    fenceType: 2;
    operator: 1;
    startFenceIds: ['19002'];
  };
  consumeChannel?: { limitChannels: ['not_limit_consume_channel'] };
  orderAmount?: { limitType: number; limitAmount: number };
  consumePeriod?: { periodType: 1 };
  consumeArea?: {
    areaSelectType: 1;
    cities: [0];
    ruleDescription: '核销地理范围：全国';
  };
  businessOperator?: { operatorType: 2; ruleDescription: '运营商选择：通用' };
  couponEffectType?: { effectType: 1 };
  consumeVehicleCategory?: {
    categories: [];
    ruleDescription: '核销车型选择：所有车型可用';
  };
}
export interface BenefitConsumeInfo {
  productId: number;
  benefitType: number;
  batchId: number;
  benefitId: string;
}
