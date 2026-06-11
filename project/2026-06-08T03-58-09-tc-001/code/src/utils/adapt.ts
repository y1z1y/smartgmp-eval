/**
 * 自适应工具函数
 *
 * 基于 750px 设计稿，提供 px → rem / vw 的转换函数，
 * 用于 inline style 中需要动态计算尺寸的场景。
 *
 * CSS/SCSS 中的 px 由 postcss-pxtorem 在构建时自动转换，无需手动处理。
 */

/** 设计稿宽度基准 */
const DESIGN_WIDTH = 750;

/**
 * 将设计稿 px 值转为 rem
 *
 * 基于 rootValue = 75（750 / 10），与 postcss-pxtorem 配置一致。
 * 运行时 html font-size = viewportWidth / 7.5，所以 rem 值会随视口宽度等比缩放。
 *
 * @example
 * numToRem(100)  // → '1.33333rem'（100 / 75）
 * numToRem(750)  // → '10rem'（750 / 75 = 10，即 100vw 宽度）
 */
export const numToRem = (px: number): string => {
  return `${parseFloat((px / (DESIGN_WIDTH / 10)).toFixed(5))}rem`;
};

/**
 * 将设计稿 px 值转为 vw
 *
 * 直接基于视口宽度比例，不依赖 root font-size。
 * 适合需要精确跟随视口宽度的场景（如全宽背景、精确占比布局）。
 *
 * @example
 * numToVw(750)  // → '100vw'
 * numToVw(100)  // → '13.33333vw'
 * numToVw(375)  // → '50vw'（半屏宽）
 */
export const numToVw = (px: number): string => {
  return `${parseFloat((px * (100 / DESIGN_WIDTH)).toFixed(5))}vw`;
};
