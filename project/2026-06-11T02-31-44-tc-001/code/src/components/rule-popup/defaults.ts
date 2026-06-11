/** 与 mono meta.ts initialValue 对齐 */
export const DEFAULT_IMAGE_CONFIG =
  'https://img-hxy021.didistatic.com/static/starimg/img/ViMWDyxVax1678454844065.png';

export const DEFAULT_RULE_POPUP_PROPS = {
  mode: 'image',
  clickMode: 'popup',
  imageConfig: DEFAULT_IMAGE_CONFIG,
  linkAddress: '',
  textColor: '',
  title: '',
  verticalOffsetDistance: 0,
  mainText: '',
  backgroundColor: '',
  highLightColor: '',
} as const;

import type { RulePopupProps } from './types';

export function resolveRulePopupProps(props: RulePopupProps): Required<RulePopupProps> {
  return {
    mode: props.mode ?? 'image',
    clickMode: props.clickMode ?? 'popup',
    imageConfig: props.imageConfig ?? DEFAULT_IMAGE_CONFIG,
    linkAddress: props.linkAddress ?? '',
    textColor: props.textColor ?? '',
    title: props.title ?? '',
    verticalOffsetDistance: props.verticalOffsetDistance ?? 0,
    mainText: props.mainText ?? '',
    backgroundColor: props.backgroundColor ?? '',
    highLightColor: props.highLightColor ?? '',
    __designMode: props.__designMode ?? '',
  };
}
