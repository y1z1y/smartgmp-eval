import type { ResolvedSharePopupProps, SharePopupProps } from './types';

/** 与 mono meta.ts initialValue 对齐 */
export const DEFAULT_SHARE_POPUP_ICON_IMG =
  'https://img-hxy021.didistatic.com/static/starimg/img/MkaTahZbYJ1678439403242.png';

export const DEFAULT_SHARE_POPUP_PROPS = {
  isVisible: true,
  iconImg: DEFAULT_SHARE_POPUP_ICON_IMG,
  defaultSite: 'right',
  verticalOffsetDistance: 0,
} as const;

export function resolveSharePopupProps(
  props: SharePopupProps,
): ResolvedSharePopupProps {
  return {
    ...props,
    isVisible: props.isVisible ?? DEFAULT_SHARE_POPUP_PROPS.isVisible,
    iconImg: props.iconImg || DEFAULT_SHARE_POPUP_PROPS.iconImg,
    defaultSite: props.defaultSite === 'left' ? 'left' : 'right',
    verticalOffsetDistance: Number(props.verticalOffsetDistance ?? 0),
  };
}