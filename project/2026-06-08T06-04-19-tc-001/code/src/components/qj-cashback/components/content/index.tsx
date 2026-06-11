import React from 'react';
import { MainTaskResult, SubTaskResult, TaskConfig } from '../../api';
import styles from './index.module.scss';
import cxbind from 'classnames/bind';
import Countdown from '../countdown';
import { htwSdkModules } from '../../../../sdk-provider';

const { url: sdkUrl, xenv, subscribe } = htwSdkModules;

export const RED_TYPE_LIST = [
  'ELECTRIC_REDPACKET',
  'COMMON_REDPACKET',
  'HTW_REDPACKET',
  'HTW_RIDING_CRASH',
  'HM_RIDING_CRASH',
  'COMMON_RIDING_CRASH',
];

const cx = cxbind.bind(styles);

const priceChange = (num: number, fractionDigits: number) =>
  parseFloat(num.toFixed(fractionDigits)).toString();

interface Props {
  taskConfigs: TaskConfig[];
  activeIndex: number;
  /**
   * 任务区域背景图
   */
  taskcontent: {
    taskContentOneImg: string;
    taskContentMoreImg: string;
  };
  mainTask: MainTaskResult;
  cyclingbtnimage: string;
  onMainBtnClick: () => void;
  reminddata: any;
  trackEventAttr: Record<string, unknown>;
  subscribeConfig: {
    scene: string;
    pageImage: string;
    buttonImage: string;
  };
}

export default function Content({
  taskConfigs,
  activeIndex,
  mainTask,
  taskcontent,
  cyclingbtnimage,
  onMainBtnClick,
  reminddata,
  trackEventAttr,
  subscribeConfig,
}: Props) {
  const getSupportedImgSrc = sdkUrl.getSupportedImgSrc;
  const doublingIconShow = mainTask?.isMultipleTask && mainTask?.multipleNum > 1;
  const WeChat = () =>
    xenv.getEnv() === 'wxmp' ||
    xenv.getEnv() === 'qjwxmp';

  const issuedAward = Number(mainTask?.issuedAward);

  const getProgressLength = () => {
    let finishNum = 0;
    const finishArr = ['8%', '20%', '52%', '85%'];
    mainTask?.subTaskResultList?.forEach((item) => {
      item.status === 2 ? finishNum++ : '';
    });
    return { width: finishArr[finishNum] };
  };
  const getSubTaskStatus = (item: SubTaskResult) => {
    let redTypeCount = 0;
    const couponList = item?.taskManualRightDTO?.rightTypeList || [];
    for (const redItemType of couponList) {
      if (RED_TYPE_LIST.indexOf(redItemType) !== -1) {
        redTypeCount++;
      } else {
        return false;
      }
    }
    if (redTypeCount === couponList.length) {
      return true;
    }
    return false;
  };
  // 是红包则return 为true
  function isRedEnvelope(item: SubTaskResult) {
    const { isSingleRedpacket } = item?.taskManualRightDTO || {};
    if (mainTask?.isMultipleTask && !isSingleRedpacket) {
      // 展示宝箱
      return false;
    }
    if (mainTask?.isMultipleTask && isSingleRedpacket) {
      return true;
    }
    if (!mainTask?.isMultipleTask && getSubTaskStatus(item)) {
      // 红包
      return true;
    }
    return false;
  }
  return (
    <div
      className={cx('main-content')}
      style={{
        backgroundImage: `url(${getSupportedImgSrc(
          taskConfigs.length === 1
            ? taskcontent?.taskContentOneImg
            : taskcontent?.taskContentMoreImg,
        )})`,
        marginTop: taskConfigs.length === 1 && '0px',
      }}
    >
      <div className={cx('main-content-title')}>
        <div className={cx('star-icon')} />
        {mainTask?.issuedAward !== undefined ? (
          <div className={cx('title-price')}>
            <div className={cx('accumulate-icon')} />
            <div className={cx('price')}>
              {priceChange(issuedAward, 2)}
              <span className={cx('price-text')}>
                <img
                  src="https://img-hxy021.didistatic.com/static/starimg/img/OpeCcyR9fm1692857526218.png"
                  alt=""
                />
              </span>
            </div>
            <div className={cx('yuan')}>
              {doublingIconShow ? (
                <div className={cx('doubling-icon')} />
              ) : null}
            </div>
          </div>
        ) : (
          <div className={cx('accumulate-default')} />
        )}
        {activeIndex > -1 ? (
          <Countdown endTime={taskConfigs[activeIndex].endTime} />
        ) : null}
      </div>
      <div className={cx('main-content-progress')}>
        <div className={cx('hight-line')} />
        <div className={cx('hight-line-top')} style={getProgressLength()} />
        <div className={cx('award-container')}>
          {mainTask?.subTaskResultList
            ? mainTask.subTaskResultList.map((item) => {
                return (
                  <div key={item.taskSeq} className={cx('award-model')}>
                    <div
                      style={{ display: item.status === 1 ? '' : 'none' }}
                      className={cx('top-icon')}
                    >
                      再骑
                      {item.progressRate.totalValue -
                        item.progressRate.currentValue}
                      单可领取
                    </div>
                    <div className={cx('award-content')}>
                      {/* 当这里是红包的时候展示这个结构，如果是宝箱，则展示不同的结构，这部分最好挪到外面通过数据判断来确定展示哪一个 */}
                      {isRedEnvelope(item) ? (
                        <div
                          className={
                            item.status === 2
                              ? cx('award-open-red')
                              : cx('award-close-red')
                          }
                        >
                          <div
                            style={{
                              display:
                                item.status === 2 &&
                                item.taskManualRightDTO.price
                                  ? ''
                                  : 'none',
                            }}
                            className={cx('award-price')}
                          >
                            {priceChange(
                              Number(item.taskManualRightDTO.price),
                              2,
                            )}
                            元
                          </div>
                        </div>
                      ) : (
                        <div
                          className={
                            item.status !== 2
                              ? cx('award-close-box')
                              : cx('award-open-box')
                          }
                        />
                      )}
                    </div>
                    <div className={cx('award-desc')}>
                      <span className={cx('black')}>
                        {mainTask.isMultipleTask &&
                        item.taskManualRightDTO.isSingleRedpacket
                          ? `${priceChange(
                              Number(item.taskManualRightDTO.originPrice),
                              3,
                            )}元`
                          : item.taskManualRightDTO.rightName}
                        <span
                          style={{
                            display:
                              mainTask.isMultipleTask &&
                              item.taskManualRightDTO.isSingleRedpacket &&
                              item.taskManualRightDTO.multipleNum
                                ? ''
                                : 'none',
                          }}
                          className={cx('red')}
                        >
                          X{item.taskManualRightDTO.multipleNum}倍
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })
            : null}
        </div>
      </div>
      <div className={cx('main-content-btn')}>
        <div
          className={WeChat() ? cx('btn') : cx('btn-big')}
          style={{
            backgroundImage: `url(${getSupportedImgSrc(cyclingbtnimage)})`,
          }}
          onClick={onMainBtnClick}
        />
        {WeChat() ? (
          <div
            className={cx('btn', 'rightBtn')}
            style={{
              backgroundImage: `url(${getSupportedImgSrc(
                reminddata.remindImage,
              )})`,
            }}
            onClick={() => {
              if (typeof window !== 'undefined' && (window as any).Omega) {
                (window as any).Omega.trackEvent(
                  'xy_px_cashback_subscribe_ck',
                  '',
                  trackEventAttr,
                );
              }
              const curEnv = xenv.getEnv();
              if (curEnv === 'wxmp' || curEnv === 'qjwxmp') {
                const subscribeInfo = {
                  ...subscribeConfig,
                  sourceChannel: 'QJ_CASHBACK',
                };
                subscribe.subscribe(subscribeInfo);
              }
            }}
          >
            <div className={cx('hand-icon')} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
