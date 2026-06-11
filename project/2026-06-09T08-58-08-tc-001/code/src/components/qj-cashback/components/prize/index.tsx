import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './index.module.scss';
import { Mask, Toast } from 'antd-mobile';
import { authReceive, BenefitResult } from '../../api';
import cxbind from 'classnames/bind';
import dayjs from 'dayjs';
import {
  BenefitConsumeInfo,
  CommonAttributes,
  ConsumeRule,
  DiscountRule,
} from '../../interface';
import { htwSdkModules } from '../../../../sdk-provider';

import CompliancePop from '../compliance-pop';
import { InView } from 'react-intersection-observer';

const { url: sdkUrl, xenv, subscribe: sdkSubscribe, share: sdkShare, goto: sdkGoto } = htwSdkModules;

export const ICON_IMG_URL: Record<string, string> = {
  '210':
    'https://s3-gz01.didistatic.com/packages-mait/img/k17UbWUiVt1721727872720.png',
  '40068':
    'https://s3-gz01.didistatic.com/packages-mait/img/hL5AAL50xn1721727907114.png',
  '41801':
    'https://s3-gz01.didistatic.com/packages-mait/img/oZfrXkxWj31721727945093.png',
  '40734':
    'https://s3-gz01.didistatic.com/packages-mait/img/oZfrXkxWj31721727945093.png',
  '41321':
    'https://s3-gz01.didistatic.com/packages-mait/img/d1DvMByGef1721728003150.png',
  '41499':
    'https://s3-gz01.didistatic.com/packages-mait/img/x8Rxo4FBOd1721728022694.png',
  '251':
    'https://s3-gz01.didistatic.com/packages-mait/img/O7qZfhKfVC1721964796498.png',
  '249':
    'https://s3-gz01.didistatic.com/packages-mait/img/apXTu5TECJ1721964819527.png',
  '308':
    'https://s3-gz01.didistatic.com/packages-mait/img/O7qZfhKfVC1721964796498.png',
  '309':
    'https://s3-gz01.didistatic.com/packages-mait/img/apXTu5TECJ1721964819527.png',
  '50': 'https://s3-gz01.didistatic.com/packages-mait/img/lJcerbl9BT1738747911789.png',
};

// 第三方业务线权益枚举：210拼车 40068租车 41801火车票  40734火车票 41321旅游 41499机票 50花小猪
// 内部业务线枚举251,249,308, 309
export const isAllChannelOrderOfSpecifyBenefitType = (
  payMisProductId: number,
) => {
  if (!payMisProductId) return false;
  return [
    210, 40068, 41801, 40734, 41321, 41499, 251, 249, 308, 309, 50,
  ].includes(+payMisProductId);
};

// 弹窗时排序到中间的权益
export const isSortToMiddlePayMisProductId = (payMisProductId: number) => {
  if (!payMisProductId) return false;
  return [210, 40068, 41801, 40734, 41321, 41499, 50].includes(
    +payMisProductId,
  );
};

const cx = cxbind.bind(styles);

interface Props {
  __designMode: string;
  skinConfigure?: {
    headImgUrl: string;
    headImgAuthUrl: string;
    rewardItemImgUrl: string;
    rewardDefaultImgUrl: string;
    rewardDoubleImgUrl: string;
  };
  buttonConfigure?: {
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
      linkConfig: {
        wxmp: string;
        qjwxmp: string;
        alimp: string;
        passenger: string;
      };
      buttonImg: string;
      buttonAuthImg: string;
    };
    share?: {
      buttonImg: string;
      buttonAuthImg: string;
    };
    buttonType: 'close' | 'subscribe' | 'link' | 'share';
  };
  awardList: BenefitResult[];
  visible: boolean;
  onClose: () => void;
  previewVisible: boolean;
}

const dialogScene = 'reward_rideCashback';

const renderOtherPic = (itemProps: any, rewardDefaultImgUrl: string) => {
  const getSupportedImgSrc = sdkUrl.getSupportedImgSrc;
  const { benefitType, benefitPic } = itemProps;
  const isOther = benefitType === 35;
  const showOtherImg =
    benefitType === 35 || benefitType === 36 || benefitType === 15;
  const otherImg =
    benefitPic ||
    'https://img-hxy021.didistatic.com/static/starimg/img/UY96qR8nub1709113954488.png';
  return (
    <div
      className={cx('coupons-item__wrap', {
        'is-other': isOther,
        'has-pic': benefitPic,
      })}
    >
      <div className={cx('item-img-box')}>
        <img
          className={cx('coupons-item__img')}
          src={getSupportedImgSrc(
            showOtherImg ? otherImg : rewardDefaultImgUrl,
          )}
        />
      </div>

      {isOther ? (
        <div className={cx('coupons-item-wrap-text')} data-last-char="看">
          {/* 完整文案为【在奖品页查看】解决剧中问题 */}
          在奖品页查
        </div>
      ) : null}
    </div>
  );
};

/**
 * 券优惠信息主体
 */
function couponsMainRender(item: BenefitResult, rewardDefaultImgUrl: string) {
  const commonAttributes = JSON.parse(
    item.commonAttributes || '{}',
  ) as CommonAttributes;
  const discountRule = (JSON.parse(item.discountRule || '{}') as DiscountRule)
    .promotionMethod;
  const consumeRule = (JSON.parse(item.consumeRule || '{}') as ConsumeRule)
    .orderAmount;

  const { couponType } = commonAttributes;
  const { discount = 0, amount = 0 } = discountRule || {};
  const { limitType = 0, limitAmount = 0 } = consumeRule || {};
  const {
    benefitType,
    benefitEffectiveTime,
    multiple = 0,
    cyclingCashAmount = 0,
    redEnvelopmentAmount = 0,
    status,
    ecomVoucherInfo,
  } = item;
  let defaultFlag = false; // 兜底位
  let num;
  let num2; // 7天7次这种第二个数用
  let unit;
  let unit2; // 7天7次这种第二个单位用
  let subTitle;

  // 根据类型拼字段
  if (benefitType === 100 && (couponType === 3 || item?.couponType === 3)) {
    // 立减券
    if (item?.isPackage) {
      num = `${(item.couponMaxAmount * 10) / 1000}`;
      subTitle = `满${
        ((item.limitType === 1 ? item.limitAmount : 0) * 10) / 1000
      }元可用`;
    } else {
      num = `${(amount * 10) / 1000}`;
      subTitle = `满${((limitType === 1 ? limitAmount : 0) * 10) / 1000}元可用`;
    }
    unit = '元';
  } else if (
    benefitType === 100 &&
    (couponType === 100 || item?.couponType === 100)
  ) {
    // 折扣券
    if (item?.isPackage) {
      num = `${(item.discount * 10) / 100}`;
      subTitle = `最高可抵${(item.couponMaxAmount * 10) / 1000}元`;
    } else {
      num = `${(discount * 10) / 100}`;
      subTitle = `最高可抵${(amount * 10) / 1000}元`;
    }
    unit = '折';
  } else if (benefitType === 37) {
    // 翻倍卡
    const date = dayjs(benefitEffectiveTime).format('M/D');
    num = `${multiple}`;
    unit = '倍';
    subTitle = `${date.split('/')[0]}月${date.split('/')[1]}日开始生效`;
  } else if (benefitType === 101) {
    // 骑行卡 favorType1时长卡，favorType2次卡
    // 如果是权益包，扁平化取字段；如果是普通情况，需要在cardResult拿字段
    let dataOrigin: any = item;
    if (!item?.isPackage) {
      dataOrigin = item.cardResult || {};
    }
    const {
      cardConfigDay = 0,
      remainTimes = 0,
      cardAmount = 0,
      favorType = 1,
    } = dataOrigin;
    num = `${cardConfigDay}`;
    unit = '天';
    if (favorType === 2) {
      num2 = `${remainTimes}`;
      unit2 = '次';
    }
    subTitle = `每次最高抵扣${(cardAmount * 10) / 1000}元`;
  } else if (benefitType === 30) {
    // 骑行金
    num = `${(cyclingCashAmount * 10) / 1000}`;
    unit = '元';
    subTitle = `需提现使用`;
  } else if (benefitType === 20) {
    // 两轮车红包
    num = `${(redEnvelopmentAmount * 10) / 1000}`;
    unit = '元';
    subTitle = `需领取使用`;
  } else if (benefitType === 15) {
    // 滴商通常规 status 判断是否授权
    //  立减：x元，x小数最多保留2位、如有两位小数，字体需要变小
    //  折扣：x折，x小数最多保留2位，如有两位小数，字体需要变小
    // type 1代金券 2折扣
    const { minUsePrice, type, discountValue, priceValue } =
      ecomVoucherInfo || {};
    const _type = type === 2;
    num = _type ? discountValue : priceValue;
    unit = _type ? '折' : '元';
    subTitle = status === 0 ? '授权后发放' : `满${minUsePrice || '-'}元可用`;
    // discountValue.substring(0, discountValue.indexof('.') + 2);
  } else {
    defaultFlag = true; // 触发兜底
  }
  return !defaultFlag ? (
    <>
      <div
        className={cx('coupons-item__main', {
          long: `${num}`.length >= 4,
          'two-num': !!num2 || `${num}`.length === 3,
          'two-long-num': !!num2 && `${num2}`.length > 1 && `${num}`.length > 1,
        })}
      >
        <span className={cx('num')}>{num}</span>
        <span className={cx('unit')}>{unit}</span>
        {num2 && (
          <>
            <span className={cx('num')}>{num2}</span>
            <span className={cx('unit')}>{unit2}</span>
          </>
        )}
      </div>
      <div className={cx('coupons-item__text')}>
        <span>{subTitle}</span>
      </div>
    </>
  ) : (
    renderOtherPic(item, rewardDefaultImgUrl)
  );
}
export default function Prize({
  __designMode,
  awardList,
  skinConfigure = {},
  buttonConfigure = {},
  visible,
  onClose,
  previewVisible = false,
}: Props) {
  const getSupportedImgSrc = sdkUrl.getSupportedImgSrc;
  const { campaignId } = sdkUrl.getAllQuery(typeof window !== 'undefined' ? window.location.href : '');
  const buttonType = buttonConfigure?.buttonType;

  const {
    headImgUrl,
    rewardItemImgUrl,
    rewardDefaultImgUrl,
    rewardDoubleImgUrl,
    headImgAuthUrl,
  } = skinConfigure || {};

  const [complianceVisible, setComplianceVisible] = useState(false);

  const getEquity = useMemo(() => {
    // 0（无滴商通权益）
    // 1（存在滴商通权益-已授权）
    // 2（存在滴商通权益-待授权）
    let equityStatus = 0;
    awardList.forEach((item) => {
      if (item.benefitType === 15 && equityStatus !== 2) {
        equityStatus = item.status === 0 ? 2 : 1;
      }
    });
    return equityStatus;
  }, [awardList]);
  const transformHeadimg = useMemo(() => {
    return getEquity === 2 ? headImgAuthUrl : headImgUrl;
  }, [getEquity, headImgAuthUrl, headImgUrl]);

  const {
    buttonImg,
    buttonAuthImg = 'https://img-hxy021.didistatic.com/static/starimg/img/z4nNL8zlsW1708936036788.png',
  } = buttonConfigure?.[buttonConfigure?.buttonType] || {};

  const trackEvent = (typeof window !== 'undefined' && (window as any).Omega?.trackEvent)
    ? (window as any).Omega.trackEvent.bind((window as any).Omega)
    : function () {};

  const updateAuthReceive = useCallback(async () => {
    const benefitConsumeInfoList: BenefitConsumeInfo[] = [];
    awardList.forEach((item) => {
      const { benefitType, status, productId, batchId, commonBenefitId } = item;
      // 只传滴商通未授权
      if (benefitType === 15 && status === 0) {
        benefitConsumeInfoList.push({
          productId,
          batchId,
          benefitId: commonBenefitId,
          benefitType,
        });
      }
    });
    const res = await authReceive({
      campaignId,
      benefitConsumeInfoListStr: JSON.stringify(benefitConsumeInfoList),
    });

    if (!res.success) {
      const showWord =
        res.code === 90001002
          ? '很抱歉，优惠券领取失败'
          : '授权失败，请到我的奖品页重试';
      Toast.show({ content: showWord, duration: 2000 });
    }
  }, []);

  const handleShare = useCallback(() => {
    const curEnv = xenv.getEnv();
    if (curEnv === 'alimp') {
      const event = new CustomEvent('share:handleShowMask', {
        detail: { visible: true },
      });
      window.dispatchEvent(event);
    } else {
      sdkShare.clickShare();
    }
  }, []);

  const handleSubscribe = useCallback(() => {
    const curEnv = xenv.getEnv();
    if (curEnv === 'wxmp' || curEnv === 'qjwxmp') {
      let subscribeInfo = {
        ...buttonConfigure?.subscribe?.dialogSubscribeConfig,
        sourceChannel: 'QJ_CASHBACK_DIALOG_SUBSCRIBE',
      };
      sdkSubscribe.subscribe(subscribeInfo);
    }

    if (curEnv !== 'wxmp' && curEnv !== 'qjwxmp') {
      handleShare();
    }
  }, [buttonConfigure, handleShare]);
  /**
   * 弹窗按钮，分类别处理
   * @returns
   */
  const handleClick = async () => {
    if (__designMode === 'design') {
      return;
    }
    const curEnv = xenv.getEnv();
    trackEvent('xy_px_getcoupon_window_ck', '', {
      clicktype: 1,
      prizenumber: awardList.length,
      parttype: dialogScene,
      scene: 'automatic',
    });
    const api_equity = getEquity === 2;
    trackEvent('xy_px_getcoupon_window_button_ck', '', {
      parttype: dialogScene,
      scene: 'automatic',
      // @ts-ignore
      buttonurl: buttonConfigure?.link?.linkConfig?.[curEnv] || '',
      api_equity: getEquity,
    });
    if (api_equity) {
      await updateAuthReceive();
    }
    if (buttonType === 'share') {
      handleShare();
    } else if (buttonType === 'subscribe') {
      handleSubscribe();
    } else if (buttonType === 'link') {
      if (buttonConfigure?.link?.linkConfig) {
        sdkGoto.open(buttonConfigure.link.linkConfig);
      }
    } else if (buttonType === 'close') {
      onClose();
      return;
    }

    onClose();
  };

  const trackScrollEventRef = useRef(false);

  useEffect(() => {
    // 弹窗显示时候埋点
    if (visible) {
      trackEvent('xy_px_getcoupon_window_sw', '', {
        parttype: dialogScene,
        scene: 'automatic',
        api_equity: getEquity,
      });
    }
  }, [visible]);
  const observerRoot = useRef(null);

  return (
    <Mask
      visible={__designMode === 'design' ? previewVisible : visible}
      color="rgba(0,0,0,0.85)"
    >
      <div className={cx('coupons-popup')}>
        <img
          className={cx('coupons-popup__head')}
          src={getSupportedImgSrc(transformHeadimg)}
        />
        <CompliancePop
          showDialog={complianceVisible}
          setShowDialog={setComplianceVisible}
        />
        <div
          ref={observerRoot}
          className={cx('coupons-popup__container')}
          onTouchStart={() => {
            /**
             * 埋点，只发一次
             */
            if (trackScrollEventRef.current) {
              return;
            }
            trackScrollEventRef.current = true;
            trackEvent('xy_px_getcoupon_window_ck', '', {
              clicktype: 3,
              prizenumber: awardList.length,
              parttype: dialogScene,
              scene: 'automatic',
            });
          }}
        >
          {awardList.map((item, index) => {
            const {
              batchName,
              benefitName,
              benefitType,
              benefitDesc,
              batchDesc,
              status,
              payMisProductId,
              commonAttributes,
            } = item;
            let title = benefitName;
            // 第三方和实物
            if (benefitType === 35 || benefitType === 36) {
              title = batchName;
            }

            let subtitle = benefitDesc;
            if (benefitType === 15) {
              subtitle =
                status === 0
                  ? '在[我的奖品页]查看'
                  : '在滴滴出行我的优惠券查看';
            }
            if (benefitType === 35 || benefitType === 36) {
              subtitle = batchDesc;
            }
            let badge = '';

            const lastPayMisProductId = commonAttributes
              ? JSON.parse(commonAttributes).payMisProductId
              : payMisProductId;

            if (
              benefitType === 100 &&
              isAllChannelOrderOfSpecifyBenefitType(lastPayMisProductId)
            ) {
              const img_url = ICON_IMG_URL[lastPayMisProductId];
              badge = img_url;
            }
            if (benefitType === 20) {
              badge = rewardDoubleImgUrl;
            }

            return (
              <InView key={item.commonBenefitId || item.batchId || index} threshold={[0, 0.6, 1]} root={observerRoot.current}>
                {({ ref, entry }) => (
                  <div
                    ref={ref}
                    className={cx('coupons-popup__item', {
                      gray: entry?.intersectionRatio < 0.6,
                    })}
                    style={{
                      backgroundImage: `url("${getSupportedImgSrc(
                        rewardItemImgUrl || rewardDefaultImgUrl,
                      )}")`,
                    }}
                  >
                    <div className={cx('coupons-popup__left')}>
                      {couponsMainRender(item, rewardDefaultImgUrl)}
                    </div>
                    <div className={cx('coupons-popup__right')}>
                      <div className={cx('coupons-popup__title')}>{title}</div>
                      {subtitle ? (
                        <div className={cx('coupons-popup__subtitle')}>
                          {subtitle}
                        </div>
                      ) : null}
                    </div>
                    {((item?.multiple && item.benefitType === 20) ||
                      item.benefitType === 100) && (
                      <div
                        className={cx('coupons-popup__badge', {
                          'is-thirdChannelOrder': item.benefitType === 100,
                        })}
                        style={{
                          backgroundImage: `url("${getSupportedImgSrc(
                            badge,
                          )}")`,
                        }}
                      />
                    )}
                  </div>
                )}
              </InView>
            );
          })}
        </div>
        {getEquity === 2 && buttonConfigure?.[buttonConfigure?.buttonType] ? (
          <div className={cx('coupons_popup_sign_text')}>
            我已阅读
            <span
              onClick={() => {
                setComplianceVisible(true);
              }}
            >
              【个人信息共享授权书】
            </span>
            ，商家券收下后可
            <br />
            【在滴滴出行我的优惠券查看】
          </div>
        ) : null}
        <img
          className={cx('coupons-popup__btn')}
          src={getSupportedImgSrc(getEquity !== 2 ? buttonImg : buttonAuthImg)}
          onClick={handleClick}
        />
        <div
          className={cx('coupons-popup__close')}
          onClick={() => {
            trackEvent('xy_px_getcoupon_window_close_ck', '', {
              parttype: dialogScene,
              scene: 'automatic',
              api_equity: getEquity,
            });
            trackEvent('xy_px_getcoupon_window_ck', '', {
              clicktype: 2,
              prizenumber: awardList.length,
              parttype: dialogScene,
              scene: 'automatic',
            });
            onClose();
          }}
        />
      </div>
    </Mask>
  );
}
