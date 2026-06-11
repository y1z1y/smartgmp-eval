export interface RulePopupProps {
  /** 模式: text 文字 | image 图标 */
  mode?: string;
  /** 点击模式: popup 弹窗 | link 跳转 */
  clickMode?: string;
  /** 图标配置图片URL */
  imageConfig?: string;
  /** 页面跳转地址 */
  linkAddress?: string;
  /** 文案颜色 */
  textColor?: string;
  /** 标题文字 */
  title?: string;
  /** 垂直偏移距离（px） */
  verticalOffsetDistance?: number;
  /** 弹窗内容 */
  mainText?: string;
  /** 浮窗背景色 */
  backgroundColor?: string;
  /** 高亮颜色 */
  highLightColor?: string;
  /** 设计模式 */
  __designMode?: string;
}
