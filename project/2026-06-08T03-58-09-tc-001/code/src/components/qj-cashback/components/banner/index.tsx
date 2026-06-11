import React from 'react';
import { TaskConfig } from '../../api';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import cxbind from 'classnames/bind';
import { htwSdkModules } from '../../../../sdk-provider';

export const ICON_IMG: Record<string, string> = {
  bigImg:
    'https://img-hxy021.didistatic.com/static/starimg/img/yxsRK3zGgL1692857398945.png',
  smallImg:
    'https://img-hxy021.didistatic.com/static/starimg/img/EMztk0bhKu1692857433747.png',
};

export const DEFAULT_CHECK_ICON =
  'https://img-hxy021.didistatic.com/static/starimg/img/t8Fd78I23E1692857645258.png';
export const BANNER_STATUS_IMAGES: Record<string, string> = {
  default:
    'https://img-hxy021.didistatic.com/static/starimg/img/iOOuMhczTn1692847902566.png',
  noHitTask:
    'https://img-hxy021.didistatic.com/static/starimg/img/iOOuMhczTn1692847902566.png',
  finished:
    'https://img-hxy021.didistatic.com/static/starimg/img/QlmxGcUwKX1692847782192.png',
  ongoing:
    'https://img-hxy021.didistatic.com/static/starimg/img/32ArL84Vm31692847852502.png',
};

const cx = cxbind.bind(styles);

interface Props {
  taskConfigs: TaskConfig[];
  activeIndex: number;
  /**
   * banner-图片
   */
  bannerimg: string;
  /**
   * 小箭头背景图
   */
  arrowimg: string;
  /**
   * 状态图片
   */
  status: Record<string, string>;
}

export default function Banner({
  taskConfigs,
  activeIndex,
  bannerimg,
  arrowimg,
  status,
}: Props) {
  const getSupportedImgSrc = htwSdkModules.url.getSupportedImgSrc;

  // 翻倍卡角标
  const iconSrc = taskConfigs.length <= 5 ? ICON_IMG.bigImg : ICON_IMG.smallImg;
  const iconClassName =
    taskConfigs.length <= 5 ? 'content-time-icon' : 'content-time-icon-small';

  // 箭头
  const checkIcon = arrowimg || DEFAULT_CHECK_ICON;

  return (
    <div
      className={cx('main-banner')}
      style={{
        backgroundImage: `url(${getSupportedImgSrc(bannerimg)})`,
      }}
    >
      {taskConfigs.map((item, index) => {
        const beginTime = dayjs(item.beginTime).startOf('day');
        const currentDate = dayjs().startOf('day');
        let statusKey = '';
        if (index === activeIndex) {
          statusKey = 'ongoing';
        } else if (beginTime.isAfter(currentDate)) {
          statusKey = 'noHitTask';
        } else {
          statusKey = 'finished';
        }

        let statusTextColor = '';

        // index < activeIndex 这个只会在有进行中任务的时候生效
        if (index < activeIndex || statusKey === 'finished') {
          statusTextColor = 'item-text-end';
        }
        if (index === activeIndex) {
          statusTextColor = 'item-text-active';
        }
        return (
          <div key={item.beginTime} className={cx('main-banner-item')}>
            <div className={cx('item-content')}>
              <div className={cx('item-content-time')}>
                <div className={cx('content-time-title', statusTextColor)}>
                  {item.title}
                </div>
                {item.showDoubleImage ? (
                  <img
                    className={cx(iconClassName)}
                    src={getSupportedImgSrc(iconSrc)}
                    alt=""
                  />
                ) : null}
              </div>
              <div className={cx(`item-content-award`, statusTextColor)}>
                {item.awardText}
              </div>
              <img
                className={cx('item-content-status')}
                src={getSupportedImgSrc(
                  status?.[statusKey] ||
                    BANNER_STATUS_IMAGES[statusKey] ||
                    BANNER_STATUS_IMAGES.default,
                )}
                alt=""
              />
              {statusKey === 'ongoing' ? (
                <img
                  className={cx('check-icon')}
                  src={getSupportedImgSrc(checkIcon)}
                  alt=""
                />
              ) : null}
            </div>
            {index !== 0 ? (
              <div className={cx('item-line')}>
                <div className={cx('item-line-left')} />
                <div className={cx('item-line-right')} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
