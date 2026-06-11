import * as React from 'react';
import { useEffect, useState } from 'react';
import { Mask } from 'antd-mobile';
import './index.scss';
import { resolveShareMaskProps } from './defaults';
import type { ShareMaskProps } from './types';

export type { ShareMaskProps } from './types';
export {
  DEFAULT_SHARE_MASK_IMG_URL,
  DEFAULT_SHARE_MASK_PROPS,
  resolveShareMaskProps,
} from './defaults';

export default function ShareMask(rawProps: ShareMaskProps) {
  const { imgurl, __designMode } = resolveShareMaskProps(rawProps);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleShowMask = (event: Event) => {
      const customEvent = event as CustomEvent<{ visible?: boolean }>;
      const visible = customEvent.detail?.visible ?? false;
      setShow(visible);
    };

    window.addEventListener('share:handleShowMask', handleShowMask, false);
    return () => {
      window.removeEventListener('share:handleShowMask', handleShowMask);
    };
  }, []);

  return React.createElement(
    Mask as unknown as React.ElementType,
    {
      className: 'mf-assets-share-mask',
      visible: __designMode === 'design' ? true : show,
      color: 'rgba(0,0,0,0.85)',
      onMaskClick: () => {
        setShow(false);
      },
    },
    React.createElement('img', {
      className: 'headerImg',
      src: imgurl,
      alt: '',
    })
  );
}

ShareMask.displayName = 'ShareMask';