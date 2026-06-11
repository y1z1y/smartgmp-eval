/** 与 mono meta.ts initialValue 对齐 — meta.ts src initialValue 为空字符串，运行时 fallback 到 banner */
export const DEFAULT_HEAD_IMG_SRC =
  'https://s3-gz01.didistatic.com/packages-mait/img/Q9V1gF2sgs1726717176187.png';

export const DEFAULT_HEAD_IMG_PROPS = {
  src: '',
  backgroundColor: '',
} as const;

import type { HeadImgProps } from './types';

/** 与原组件 src || banner 逻辑等价：src 为空字符串时 fallback 到默认头图 */
export function resolveHeadImgProps(props: HeadImgProps): Required<HeadImgProps> {
  return {
    src: props.src || DEFAULT_HEAD_IMG_SRC,
    backgroundColor: props.backgroundColor ?? '',
  };
}
