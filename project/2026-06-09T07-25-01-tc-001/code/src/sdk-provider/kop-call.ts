/**
 * kopCall — 统一 KOP 接口调用封装
 *
 * 对 kop.send 的高层封装，自动处理 axios response unwrap 和错误码判断。
 * 组件层只需关心业务数据，无需重复处理 response.data.code 判断。
 */
import * as kop from './htw-sdk/kop';

export interface KopSuccess<T> {
  success: true;
  data: T;
  code: number;
}

export interface KopFailure {
  success: false;
  code: number;
  msg: string;
  raw?: any;
}

export type KopResult<T> = KopSuccess<T> | KopFailure;

/**
 * 调用 KOP 接口并返回标准化结果。
 *
 * 成功条件: response.data.code === 200 || response.data.code === 0
 * 成功时 data 取 response.data.data ?? response.data.result
 *
 * @example
 * const res = await kopCall<TaskListResult>('prado...queryTaskList', params);
 * if (res.success) {
 *   console.log(res.data); // TaskListResult
 * } else {
 *   console.error(res.msg);
 * }
 */
export async function kopCall<T = any>(api: string, params: any): Promise<KopResult<T>> {
  try {
    const res = await kop.send<any, any>(api, params);
    const body = res?.data;
    const code = body?.code ?? 999;

    if (code === 200 || code === 0) {
      return {
        success: true,
        data: (body.data ?? body.result) as T,
        code,
      };
    }

    return {
      success: false,
      code,
      msg: body?.msg || body?.message || `KOP error: code=${code}`,
      raw: body,
    };
  } catch (err: any) {
    return {
      success: false,
      code: err?.code || 999,
      msg: err?.message || String(err),
    };
  }
}
