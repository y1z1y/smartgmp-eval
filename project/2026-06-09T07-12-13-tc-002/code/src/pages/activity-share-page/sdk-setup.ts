import { builtinHtwSdk } from '../../sdk-provider/htw-sdk'
import { pageComponentProps } from './page-component-props'

if (typeof window !== 'undefined') {
  ;(window as any).__env__ = "stable"
  ;(window as any).__appConfig__ = {"campaignId":"10289487","bizId":"363","noForceLogin":false,"pagePreviewMock":true,"simCluster":"zjy-dev-v"}
  ;(window as any).__PAGE_NAME__ = "activity-share-page"
  ;(window as any).__PAGE_SCHEMA__ = {"head-img":{"componentName":"HeadImg","props":{"src":{"type":"string","description":"头图图片URL，宽度750px，高度可调节","default":""},"backgroundColor":{"type":"string","description":"背景颜色，图片加载前或图片下方显示的填充色","default":""}}},"count-down":{"componentName":"CountDown","props":{"textColor":{"type":"string","description":"字体颜色","default":"#FFFFFF","category":"样式配置"},"bgColor":{"type":"string","description":"背景色","default":"rgba(44,45,47,0.5)","category":"样式配置"},"verticalOffsetDistance":{"type":"number","description":"垂直方向偏移距离","default":0,"category":"布局配置"}}},"rule-popup":{"componentName":"RulePopup","props":{"mode":{"type":"string","description":"触发模式: text 文字按钮 | image 图标按钮","default":"image"},"clickMode":{"type":"string","description":"点击模式: popup 弹窗展示 | link 页面跳转","default":"link"},"imageConfig":{"type":"string","description":"图标配置图片URL（146*43px），mode为image时显示","default":"https://img-hxy021.didistatic.com/static/starimg/img/ViMWDyxVax1678454844065.png"},"linkAddress":{"type":"string","description":"页面跳转地址，clickMode为link时使用，#/prize跳奖品页，含myRidingCards跳骑行卡","default":""},"title":{"type":"string","description":"触发按钮文字，mode为text时显示","default":""},"textColor":{"type":"string","description":"触发按钮文字颜色","default":""},"backgroundColor":{"type":"string","description":"触发按钮背景色","default":""},"verticalOffsetDistance":{"type":"number","description":"垂直偏移距离（px），正值向下偏移","default":0},"mainText":{"type":"string","description":"弹窗内容文本，{文字}会被高亮显示","default":""},"highLightColor":{"type":"string","description":"弹窗内容高亮颜色","default":""}}},"share-mask":{"componentName":"ShareMask","props":{"imgurl":{"type":"string","description":"分享蒙层图片地址，默认使用原组件 CDN 图","default":"https://img-hxy021.didistatic.com/static/starimg/node/rIyEfPzFVp1678775952135.png","category":"图片配置"}}}}
  ;(window as any).__PAGE_COMPONENT_PROPS__ = pageComponentProps
  ;(window as any).htwSdk = builtinHtwSdk
  ;(window as any).__mf_sdk__ = { insertAndStartPopQueue: () => {} }
  ;(window as any).Omega = { trackEvent: () => {} }
  window.addEventListener('message', function (e) {
    var d = e.data
    if (!d || d.type !== 'skywalker-set-page-preview-mock') return
    var cfg = (window as any).__appConfig__ || {}
    cfg.pagePreviewMock = d.value !== false
    ;(window as any).__appConfig__ = cfg
  })
}
