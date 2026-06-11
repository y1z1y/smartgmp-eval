import React from 'react';
import './index.scss';

interface RulePopupProps {
  visible: boolean;
  headerImage?: string;
  closeImage?: string;
  content?: string;
  bgColor?: string;
  onClose: () => void;
}

const DEFAULT_POPUP_HEADER =
  'https://ut-static.udache.com/webx/yingkesong/QSi3unNYKzTfr5x5An5FJ.png';
const DEFAULT_POPUP_CLOSE =
  'https://ut-static.udache.com/webx/yingkesong/Op4F4bPQHkMfO76Cyu68X.png';
const DEFAULT_POPUP_CONTENT =
  '<div style="text-align:center;">' +
  '<p style="font-size:14px;color:#333;line-height:1.8;">' +
  '1. 活动期间，用户可通过分享邀请好友参与<br/>' +
  '2. 好友完成首单后，邀请人可获得现金奖励<br/>' +
  '3. 奖励将在好友完成订单后发放至钱包<br/>' +
  '4. 本活动最终解释权归平台所有' +
  '</p></div>';

export default function RulePopup(props: RulePopupProps): JSX.Element | null {
  const {
    visible,
    headerImage,
    closeImage,
    content,
    bgColor = '#FFDFC0',
    onClose,
  } = props;

  if (!visible) return null;

  const resolvedHeader = headerImage || DEFAULT_POPUP_HEADER;
  const resolvedClose = closeImage || DEFAULT_POPUP_CLOSE;
  const resolvedContent = content || DEFAULT_POPUP_CONTENT;

  return (
    <div className="mf-act-header__popup-mask" onClick={onClose}>
      <div
        className="mf-act-header__popup-sheet"
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="mf-act-header__popup-bg" style={{ backgroundColor: bgColor }} />
        <img className="mf-act-header__popup-header-img" src={resolvedHeader} alt="" />
        <img
          className="mf-act-header__popup-close"
          src={resolvedClose}
          alt="关闭"
          onClick={onClose}
        />
        <div className="mf-act-header__popup-body">
          <div
            className="mf-act-header__popup-content"
            dangerouslySetInnerHTML={{ __html: resolvedContent }}
          />
        </div>
      </div>
    </div>
  );
}
