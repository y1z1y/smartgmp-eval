import qs from 'qs';
import { diffParamsForTrack, trackForParamsError } from './error-track';

type WebpFeature = 'lossy' | 'lossless' | 'alpha' | 'animation';

export function getAllQuery(url: string): Record<string, string> {
  diffParamsForTrack('getAllQuery', { url }, ['url']);
  const parsedUrl = new URL(url);
  const searchQuery = qs.parse(parsedUrl.search, {
    ignoreQueryPrefix: true,
  }) as Record<string, string>;
  const firstQuestion = parsedUrl.hash.indexOf('?');
  const hashSearch = firstQuestion === -1 ? '' : parsedUrl.hash.slice(firstQuestion);
  const hashQuery = qs.parse(hashSearch, {
    ignoreQueryPrefix: true,
  }) as Record<string, string>;
  return { ...searchQuery, ...hashQuery };
}

export const genNewUrl = (url: string) => {
  try {
    diffParamsForTrack('genNewUrl', { url }, ['url']);
    const curQuery = getAllQuery(window.location.href);
    const link = new URL(url);
    const targetSearch = Object.fromEntries(new URLSearchParams(link.search));
    const mergedQuery = new URLSearchParams({ ...curQuery, ...targetSearch });
    return `${link.origin}${link.pathname}?${mergedQuery.toString()}${link.hash}`;
  } catch {
    throw new Error(`Invalid URL provided: ${url}`);
  }
};

export async function checkWebpFeature(feature: WebpFeature): Promise<boolean> {
  diffParamsForTrack('checkWebpFeature', { feature }, ['feature']);
  return new Promise((resolve) => {
    const kTestImages: Record<WebpFeature, string> = {
      lossy: 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
      lossless: 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
      alpha:
        'UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==',
      animation:
        'UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA',
    };
    const img = new Image();
    img.onload = function () {
      resolve(img.width > 0 && img.height > 0);
    };
    img.onerror = function () {
      resolve(false);
    };
    img.src = `data:image/webp;base64,${kTestImages[feature]}`;
  });
}

export function getSupportedImgSrcSync(src: string): string {
  if (!src) {
    trackForParamsError('getSupportedImgSrcSync', 'src', { src });
    return src;
  }
  if (src.endsWith('.gif')) return src;
  try {
    const prefixedSrc = src.indexOf('//') === 0 ? `https:${src}` : src;
    const url = new URL(prefixedSrc);
    const hasAddon = url.searchParams.get('x-s3-process') === 'image/format,webp';
    const isSupportWebp =
      typeof window !== 'undefined' && (window as any).isSupportWebp;
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

export const getSupportedImgSrc = getSupportedImgSrcSync;
