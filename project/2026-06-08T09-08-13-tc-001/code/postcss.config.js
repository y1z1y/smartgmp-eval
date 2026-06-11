/**
 * PostCSS 配置 — 移动端自适应（与 Playground 对齐）
 *
 * 设计稿基准：375px
 * rootValue: 50 → 配合 html font-size = max(viewportWidth, 375) / 7.5
 * 375px 宽度下 1rem = 50px
 */
export default {
  plugins: {
    'postcss-pxtorem': {
      rootValue: 50,
      unitPrecision: 5,
      propList: ['*'],
      // 与 Playground 一致：组件根类 .mf-* 内的 px 也要转 rem，才能随 html font-size 缩放
      selectorBlackList: [],
      replace: true,
      mediaQuery: false,
      minPixelValue: 1,
    },
  },
}
