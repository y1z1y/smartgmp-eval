/**
 * URL 工具函数 — 从 mf-page/src/htw-sdk/url.ts 提取的纯浏览器逻辑。
 * 不依赖 lodash/qs 等重库，使用标准 Web API 重实现。
 */

export function getAllQuery(url: string): Record<string, string> {
  try {
    const parsedUrl = new URL(url);
    const result: Record<string, string> = {};

    parsedUrl.searchParams.forEach((value, key) => {
      result[key] = value;
    });

    const hashQuestionIndex = parsedUrl.hash.indexOf('?');
    if (hashQuestionIndex !== -1) {
      const hashSearch = parsedUrl.hash.slice(hashQuestionIndex + 1);
      new URLSearchParams(hashSearch).forEach((value, key) => {
        result[key] = value;
      });
    }

    return result;
  } catch {
    return {};
  }
}

export function genNewUrl(url: string): string {
  try {
    const curQuery = getAllQuery(window.location.href);
    const link = new URL(url);
    const targetSearch = Object.fromEntries(new URLSearchParams(link.search));
    const mergedQuery = new URLSearchParams({ ...curQuery, ...targetSearch });
    return `${link.origin}${link.pathname}?${mergedQuery.toString()}${link.hash}`;
  } catch {
    return url;
  }
}

export function getSupportedImgSrc(src: string): string {
  if (!src || src.endsWith('.gif')) return src;
  try {
    const prefixedSrc = src.indexOf('//') === 0 ? `https:${src}` : src;
    const url = new URL(prefixedSrc);
    const hasAddon = url.searchParams.get('x-s3-process') === 'image/format,webp';
    const isSupportWebp = typeof window !== 'undefined' && (window as any).isSupportWebp;

    if (isSupportWebp && !hasAddon) {
      url.searchParams.append('x-s3-process', 'image/format,webp');
    } else if (!isSupportWebp && hasAddon) {
      url.searchParams.delete('x-s3-process');
    }
    return url.href;
  } catch {
    return src;
  }
}
