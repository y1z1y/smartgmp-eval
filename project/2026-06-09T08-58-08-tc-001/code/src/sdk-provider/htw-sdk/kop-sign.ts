import { MD5, SHA1, enc } from 'crypto-js';

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function sign(appSec: string, params: any, data?: any) {
  const signObj = { ...params, ...data };
  const keys = Object.keys(signObj);
  keys.sort((a, b) => (a < b ? -1 : 1));

  const signStr =
    appSec +
    keys
      .map((v) => {
        const value = isObject(signObj[v]) ? JSON.stringify(signObj[v]) : signObj[v];
        return `${v}${value}`;
      })
      .join('') +
    appSec;
  return MD5(signStr).toString();
}

function recursionToString(data: Record<string, any>, prefix: string): string {
  const keys = Object.keys(data);
  keys.sort((a, b) => (a < b ? -1 : 1));
  return keys
    .map((v) => {
      const key = prefix === '' ? v : `${prefix}[${v}]`;
      const isObj = isObject(data[v]);
      const value = isObj ? recursionToString(data[v], key) : data[v];
      return isObj ? value : `${key}${value}`;
    })
    .join('');
}

export function formUrlencodedSign(appSec: string, params: any, data?: any) {
  const signObj = { ...params, ...data };
  const keys = Object.keys(signObj);
  keys.sort((a, b) => (a < b ? -1 : 1));
  const signStr = appSec + recursionToString(signObj, '') + appSec;
  return MD5(signStr).toString();
}

export function kopSignH5(appSec: string, params: any, data?: any) {
  const signObj = { ...params, ...data };
  const keys = Object.keys(signObj);
  keys.sort((a, b) => (a < b ? 1 : -1));
  const encryptRaw = keys.reduce((prev, k) => `${prev}${k}${signObj[k]}`, appSec) + appSec;
  return SHA1(enc.Base64.stringify(enc.Utf8.parse(encryptRaw))).toString();
}
