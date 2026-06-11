import React, { useState, useMemo } from 'react';
import { Mask } from 'antd-mobile';
import { RulePopupProps } from './types';
import { resolveRulePopupProps } from './defaults';
import './index.scss';

export type { RulePopupProps } from './types';
export { DEFAULT_IMAGE_CONFIG, resolveRulePopupProps } from './defaults';

const RulePopup = (rawProps: RulePopupProps) => {
  const {
    mode,
    clickMode,
    imageConfig,
    linkAddress,
    textColor,
    title,
    mainText,
    verticalOffsetDistance,
    backgroundColor,
    highLightColor,
    __designMode,
    ...others
  } = resolveRulePopupProps(rawProps);

  const eventId = useMemo(() => {
    if (linkAddress === '#/prize') {
      return 'xy_px_draw_myrecord_ck';
    } else if (linkAddress.indexOf('myRidingCards') > -1) {
      return 'qj_px_ipjointly_mycard_ck';
    } else {
      return 'xy_px_draw_rules_ck';
    }
  }, [linkAddress]);

  const {
    trackEvent = () => {},
    buildUrl = () => {},
    getQuery = () => {},
  } = (typeof window !== 'undefined' && (window as any).__mf_sdk__) || {};

  const [visible, setVisible] = useState(false);

  const formatText = () => {
    const newText = mainText.replace(/\{(.+?)\}/g, (match, param) => {
      return `<b style="color:${highLightColor}">${param}</b>`;
    });
    return <span dangerouslySetInnerHTML={{ __html: newText }} />;
  };

  const handleClick = () => {
    trackEvent(eventId);
    if (clickMode === 'popup') {
      setVisible(true);
    } else if (clickMode === 'link' && linkAddress) {
      setTimeout(() => {
        (window as any)?.htwSdk?.goto?.open({
          passenger:
            linkAddress.startsWith('#/') || linkAddress === 'home'
              ? linkAddress
              : buildUrl(linkAddress, { ...getQuery() }),
        });
      }, 200);
    }
  };

  const translateY =
    __designMode === 'design'
      ? `${verticalOffsetDistance}px`
      : `${verticalOffsetDistance / 100}rem`;

  const style = {
    transform: `translateY(${translateY}) `,
  };

  return (
    <div
      className={
        mode === 'text'
          ? 'mf-assets-rule-popup container-tip'
          : 'mf-assets-rule-popup icon-tip'
      }
      {...others}
    >
      <div className="rule-popup-trigger" style={style}>
        {mode === 'text' ? (
          <div className="tip-container" style={{ backgroundColor }}>
            <div className="tip-text" style={{ color: textColor }} onClick={handleClick}>
              {title}
            </div>
          </div>
        ) : mode === 'image' && imageConfig ? (
          <img className="tip-icon" src={imageConfig} alt="" onClick={handleClick} />
        ) : null}
      </div>
      <Mask visible={visible}>
        <div className="rule-popup">
          <div className="rule-popup__title">活动规则</div>
          <div className="rule-popup__content">{formatText()}</div>
          <div className="rule-popup__footer" />
          <img
            className="rule-popup__close"
            onClick={() => setVisible(false)}
            src="//pt-starimg.didistatic.com/static/starimg/img/z7iHNcBR5H1559011533212.png"
            alt=""
          />
        </div>
      </Mask>
    </div>
  );
};

RulePopup.displayName = 'RulePopup';

export default RulePopup;
