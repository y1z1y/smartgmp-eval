import type { CountDownProps, ResolvedCountDownProps } from './types';

export const DEFAULT_COUNT_DOWN_PROPS = {
  textColor: '#FFFFFF',
  bgColor: 'rgba(44,45,47,0.5)',
  verticalOffsetDistance: 0,
} as const;

export function resolveCountDownProps(rawProps: CountDownProps): ResolvedCountDownProps {
  return {
    ...rawProps,
    textColor: rawProps.textColor ?? DEFAULT_COUNT_DOWN_PROPS.textColor,
    bgColor: rawProps.bgColor ?? DEFAULT_COUNT_DOWN_PROPS.bgColor,
    verticalOffsetDistance: Number(
      rawProps.verticalOffsetDistance ?? DEFAULT_COUNT_DOWN_PROPS.verticalOffsetDistance,
    ),
  };
}