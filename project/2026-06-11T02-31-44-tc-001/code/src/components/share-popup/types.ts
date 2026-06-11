import type React from 'react';

export interface SharePopupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick' | 'style'> {
  isVisible?: boolean;
  iconImg?: string;
  defaultSite?: 'left' | 'right';
  verticalOffsetDistance?: number;
  __designMode?: string;
}

export interface ResolvedSharePopupProps
  extends Omit<SharePopupProps, 'isVisible' | 'iconImg' | 'defaultSite' | 'verticalOffsetDistance'> {
  isVisible: boolean;
  iconImg: string;
  defaultSite: 'left' | 'right';
  verticalOffsetDistance: number;
}