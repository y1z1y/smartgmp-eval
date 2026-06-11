import React, { useMemo } from 'react';
import { atom, useAtomValue } from 'jotai';
import { resolveCountDownProps } from './defaults';
import type { CountDownProps, PageBase } from './types';
import './index.scss';

export type { CountDownProps, PageBase } from './types';
export { DEFAULT_COUNT_DOWN_PROPS, resolveCountDownProps } from './defaults';

const defaultPageBaseAtom = atom<PageBase>({
  campaignEndTime: Date.now() + 1 * 24 * 3600 * 1000,
  groupName: '',
});

function propPxToRem(prop: string) {
  const reg = /(\d)+(px)/gi;
  if (reg.test(prop)) {
    return prop.replace(reg, (value) => {
      const normalized = value.replace(/px/i, '');
      return `${parseFloat(normalized) / 100}rem`;
    });
  }
  return prop;
}

export default function CountDown(rawProps: CountDownProps) {
  const props = resolveCountDownProps(rawProps);
  const {
    atomMap,
    store,
    textColor,
    bgColor,
    verticalOffsetDistance = 0,
    __designMode,
  } = props;

  const pageBase = useAtomValue(atomMap?.pageBaseAtom || defaultPageBaseAtom, {
    store,
  });

  const endTime = useMemo(() => {
    return Math.ceil(
      (pageBase.campaignEndTime - new Date().getTime()) / 24 / 3600 / 1000,
    ).toString();
  }, [pageBase.campaignEndTime]);

  const translateY = useMemo(
    () => propPxToRem(`${verticalOffsetDistance}px`),
    [verticalOffsetDistance],
  );

  return (
    <div
      className="mf-assets-count-down"
      style={{
        backgroundColor: bgColor,
        transform: `translate(-50%, ${translateY})`,
      }}
    >
      <div
        className="count-down__text"
        style={{
          color: textColor,
        }}
      >
        距活动结束还剩{endTime}天
      </div>
    </div>
  );
}

CountDown.displayName = 'CountDown';