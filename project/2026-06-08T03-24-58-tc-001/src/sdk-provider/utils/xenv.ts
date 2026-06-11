/**
 * 运行环境检测 — 从 mf-page/src/htw-sdk/xenv.ts 提取的纯浏览器逻辑。
 * 不依赖任何私有包，可在组件内直接 import 使用。
 */

export type XEnv =
  | 'wxmp'
  | 'alimp'
  | 'qjwxmp'
  | 'crwxmp'
  | 'passenger'
  | 'h5'
  | 'wxh5'
  | '';

let cachedEnv: XEnv = '';

export function getEnv(): XEnv {
  if (cachedEnv) return cachedEnv;
  if (typeof window === 'undefined') return 'h5';

  const ua: string = window.navigator.userAgent;
  const query = getAllQuerySimple(window.location.href);
  const env = query.env || '';
  const xenvQuery = query.xenv || '';

  if (/didi\.passenger/.test(ua)) {
    cachedEnv = 'passenger';
  } else if (/MicroMessenger/i.test(ua)) {
    if (/miniProgram/i.test(ua)) {
      if (env === 'qj') {
        cachedEnv = 'qjwxmp';
      } else if (env === 'crwxmp' || xenvQuery === 'crwxmp') {
        cachedEnv = 'crwxmp';
      } else {
        cachedEnv = 'wxmp';
      }
    } else {
      cachedEnv = 'wxh5';
    }
  } else if (/AlipayClient/i.test(ua)) {
    cachedEnv = 'alimp';
  } else {
    cachedEnv = 'h5';
  }
  return cachedEnv;
}

export function getMethodByEnv<T>(config: Partial<Record<XEnv, T>> & { h5: T }): T {
  const env = getEnv();
  if (env === 'wxh5') return config.wxh5 ?? config.h5;
  if (env === 'crwxmp') return config.crwxmp ?? config.wxmp ?? config.h5;
  return config[env] ?? config.h5;
}

function getAllQuerySimple(url: string): Record<string, string> {
  try {
    const u = new URL(url);
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { params[k] = v; });
    const hashQ = u.hash.indexOf('?');
    if (hashQ !== -1) {
      new URLSearchParams(u.hash.slice(hashQ + 1)).forEach((v, k) => { params[k] = v; });
    }
    return params;
  } catch {
    return {};
  }
}
