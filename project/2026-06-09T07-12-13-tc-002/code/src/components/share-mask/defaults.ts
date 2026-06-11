import type { ResolvedShareMaskProps, ShareMaskProps } from './types';

export const DEFAULT_SHARE_MASK_IMG_URL =
  'https://img-hxy021.didistatic.com/static/starimg/node/rIyEfPzFVp1678775952135.png';

export const DEFAULT_SHARE_MASK_PROPS: ResolvedShareMaskProps = {
  imgurl: DEFAULT_SHARE_MASK_IMG_URL,
  __designMode: undefined,
};

export function resolveShareMaskProps(rawProps: ShareMaskProps): ResolvedShareMaskProps {
  return {
    ...DEFAULT_SHARE_MASK_PROPS,
    ...rawProps,
    imgurl: rawProps.imgurl || DEFAULT_SHARE_MASK_IMG_URL,
  };
}