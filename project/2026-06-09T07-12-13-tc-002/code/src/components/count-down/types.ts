import type { PrimitiveAtom } from 'jotai';

export interface PageBase {
  campaignEndTime: number;
  groupName: string;
}

export interface CountDownProps {
  textColor?: string;
  bgColor?: string;
  verticalOffsetDistance?: number;
  __designMode?: string;
  store?: any;
  atomMap?: {
    pageBaseAtom: PrimitiveAtom<PageBase>;
  };
}

export interface ResolvedCountDownProps
  extends Required<
    Pick<CountDownProps, 'textColor' | 'bgColor' | 'verticalOffsetDistance'>
  > {
  __designMode?: string;
  store?: any;
  atomMap?: CountDownProps['atomMap'];
}