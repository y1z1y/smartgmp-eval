import React from 'react';
import { HeadImgProps } from './types';
import { resolveHeadImgProps } from './defaults';
import './index.scss';

export type { HeadImgProps } from './types';
export { DEFAULT_HEAD_IMG_SRC, resolveHeadImgProps } from './defaults';

export default function HeadImg(rawProps: HeadImgProps) {
  const { src, backgroundColor } = resolveHeadImgProps(rawProps);

  return (
    <img
      src={src}
      alt=""
      className="mf-head-img"
      style={{ backgroundColor }}
    />
  );
}

HeadImg.displayName = 'HeadImg';
