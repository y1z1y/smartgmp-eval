import { useEffect } from 'react';

/**
 * 自适应容器组件 — 设置根字体大小实现 rem 等比缩放
 *
 * 原理：
 *   html { font-size: viewportWidth / 7.5 }
 *   - 375px 视口 → font-size: 50px → 1rem = 50px
 *   - 414px 视口 → font-size: 55.2px → 1rem = 55.2px
 *   - 320px 视口 → font-size: 42.67px → 1rem = 42.67px
 *
 * 配合 postcss-pxtorem（rootValue: 75，750px 设计稿基准）自动将 CSS 中的 px 转为 rem，
 * 实现"写 px、自动缩放"的效果，组件代码无需任何修改。
 *
 * 最低视口宽度限制为 375px，避免过窄屏幕下元素过小不可用。
 */
export function AdaptiveContainer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const setRootFontSize = () => {
      const width = Math.max(window.innerWidth, 375);
      document.documentElement.style.fontSize = `${width / 7.5}px`;
    };

    setRootFontSize();
    window.addEventListener('resize', setRootFontSize);

    return () => window.removeEventListener('resize', setRootFontSize);
  }, []);

  return <>{children}</>;
}
