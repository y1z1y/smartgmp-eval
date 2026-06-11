import React from 'react';
import { htwSdkModules } from '../../sdk-provider';
import './index.scss';
import type { SharePopupProps } from './types';
import { resolveSharePopupProps } from './defaults';

export type { SharePopupProps } from './types';
export {
  DEFAULT_SHARE_POPUP_ICON_IMG,
  DEFAULT_SHARE_POPUP_PROPS,
  resolveSharePopupProps,
} from './defaults';

const { xenv, share, url } = htwSdkModules;

function trackShareClick() {
  if (typeof window === 'undefined') {
    return;
  }

  (window as Window & { Omega?: { trackEvent?: (...args: any[]) => void } }).Omega?.trackEvent?.(
    'xy_px_sharebtn_ck',
    '',
    {},
  );
}

function getTranslateY(verticalOffsetDistance: number, designMode?: string) {
  if (designMode === 'design') {
    return `${verticalOffsetDistance}px`;
  }

  return `${parseFloat((verticalOffsetDistance / 50).toFixed(5))}rem`;
}

export default function SharePopup(rawProps: SharePopupProps) {
  const props = resolveSharePopupProps(rawProps);
  const { className, __designMode, iconImg, isVisible, defaultSite, verticalOffsetDistance, ...others } = props;

  const handleShare = () => {
    trackShareClick();

    const env = xenv.getEnv();
    if (env === 'passenger' || env === 'wxmp' || env === 'qjwxmp') {
      share.clickShare();
      return;
    }

    const event = new CustomEvent('share:handleShowMask', {
      detail: {
        isible: true,
      },
    });
    window.dispatchEvent(event);
  };

  const translateY = getTranslateY(verticalOffsetDistance, __designMode);
  const style = {
    transform: `translateY(${translateY})`,
    ...(defaultSite === 'left' ? { left: 0 } : { right: 0 }),
  } as React.CSSProperties;

  return isVisible && iconImg ? (
    <div
      className={['mf-assets-share-popup', className].filter(Boolean).join(' ')}
      {...others}
      style={style}
      onClick={handleShare}
    >
      <img
        className="share-popup__img"
        src={url.getSupportedImgSrc(iconImg)}
        alt=""
      />
    </div>
  ) : null;
}

SharePopup.displayName = 'SharePopup';