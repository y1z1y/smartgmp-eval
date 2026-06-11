import React, { forwardRef, ForwardRefRenderFunction, useState, useCallback } from 'react';
import RulePopup from './components/rule-popup';
import './index.scss';

export interface ActHeaderProps {
  headImage?: string;
  showRuleBtn?: boolean;
  ruleBtnImage?: string;
  ruleBtnAction?: 'popup' | 'link';
  ruleBtnLink?: string;
  popupHeaderImage?: string;
  popupCloseImage?: string;
  popupContent?: string;
  popupBgColor?: string;
  previewConfig?: {
    showPopup?: boolean;
  };
  __designMode?: 'design' | undefined;
  componentId?: string;
}

const DEFAULT_HEAD_IMAGE =
  'https://ut-static.udache.com/webx/yingkesong/QwobP-IEdLxINgenBfw8W.png';
const DEFAULT_RULE_BTN_IMAGE =
  'https://ut-static.udache.com/webx/yingkesong/f2FpoRgnfQtvYLqMK2P7j.png';

function ActHeaderComponent(
  props: ActHeaderProps,
  ref: React.Ref<HTMLDivElement>,
): JSX.Element {
  const {
    componentId,
    __designMode,
    headImage,
    showRuleBtn = true,
    ruleBtnImage,
    ruleBtnAction = 'popup',
    ruleBtnLink = '',
    popupHeaderImage,
    popupCloseImage,
    popupContent,
    popupBgColor,
    previewConfig,
  } = props;

  const [popupVisible, setPopupVisible] = useState(false);

  const resolvedHeadImage = headImage || DEFAULT_HEAD_IMAGE;
  const resolvedRuleBtnImage = ruleBtnImage || DEFAULT_RULE_BTN_IMAGE;

  const isDesignPreview =
    __designMode === 'design' &&
    previewConfig != null &&
    previewConfig.showPopup === true;

  const handleRuleBtnClick = useCallback(() => {
    if (ruleBtnAction === 'link' && ruleBtnLink) {
      window.location.href = ruleBtnLink;
      return;
    }
    setPopupVisible(true);
  }, [ruleBtnAction, ruleBtnLink]);

  const handlePopupClose = useCallback(() => {
    setPopupVisible(false);
  }, []);

  return (
    <div ref={ref} id={componentId} className="mf-act-header">
      <img className="mf-act-header__bg" src={resolvedHeadImage} alt="" />
      {showRuleBtn && (
        <img
          className="mf-act-header__rule-btn"
          src={resolvedRuleBtnImage}
          alt="规则"
          onClick={handleRuleBtnClick}
        />
      )}
      <RulePopup
        visible={popupVisible || isDesignPreview}
        headerImage={popupHeaderImage}
        closeImage={popupCloseImage}
        content={popupContent}
        bgColor={popupBgColor}
        onClose={handlePopupClose}
      />
    </div>
  );
}

const RefActHeaderComponent = forwardRef(
  ActHeaderComponent as ForwardRefRenderFunction<HTMLDivElement, ActHeaderProps>,
);
RefActHeaderComponent.displayName = 'ActHeader';

export default RefActHeaderComponent;
