import { getMethodByEnv, getEnv } from './xenv';
import { getAllQuery } from './url';
import { trackForParamsError, diffParamsForTrack } from './error-track';
import qs from 'qs';

const QJWXMP_SUBSCRIBE_PATH = '/subpackages/marketingProcess/common_share/common_share';
const DIDIWXMP_SUBSCRIBE_PATH = '/qingju/subpackages/marketingProcess/common_share/common_share';

interface SubscribeWxParams {
  scene: string;
  pageImage: string;
  buttonImage: string;
  sourceChannel: string;
}

interface SubscribeParams {
  activityId: number | string;
  backUrl?: string;
}

export async function subscribeWebx(config: SubscribeParams): Promise<void> {
  if (!config.activityId) {
    trackForParamsError('subscribeWebx', 'activityId', config);
    console.warn('missing required params activityId');
    return;
  }
  const params: Record<string, any> = {
    type: 'subscribe',
    activity_id: config.activityId,
  };
  if (config.backUrl) {
    params.back_url = encodeURIComponent(config.backUrl);
  }
  const finallyParams = qs.stringify(params, { arrayFormat: 'brackets', addQueryPrefix: false });
  (window as any).wx?.miniProgram?.navigateTo({
    url: `/webx-mp-next/transfer-station/index?${finallyParams}`,
  });
}

const subscribeWX = (config: SubscribeWxParams) => {
  diffParamsForTrack('subscribeWX', config, ['scene', 'pageImage', 'buttonImage']);
  if (!config.scene) return;

  const { campaignId = '', bizId = '', ddchn = '' } = getAllQuery(window.location.href);
  const groupName =
    (window as any).__store__?.get?.((window as any).__atomMap__?.pageBaseAtom)?.groupName || '';
  const params = {
    type: 1,
    scene: config.scene,
    pageImage: config.pageImage,
    btnImg: config.buttonImage,
    sourceChannel: config.sourceChannel || 'MF_PAGE',
    channelId: ddchn,
    groupName,
    bizId,
    campaignId,
  };
  const env = getEnv();
  const path = env === 'wxmp' ? DIDIWXMP_SUBSCRIBE_PATH : QJWXMP_SUBSCRIBE_PATH;
  const finallyParams = qs.stringify(params, { arrayFormat: 'brackets', addQueryPrefix: false });
  (window as any).wx?.miniProgram?.navigateTo({
    url: `${path}?${finallyParams}`,
  });
};

async function emptySubscribe(config: SubscribeParams): Promise<void> {
  console.log('当前环境无订阅能力', config);
}

export const subscribe = getMethodByEnv({
  wxmp: subscribeWX,
  alimp: emptySubscribe,
  qjwxmp: subscribeWX,
  crwxmp: subscribeWX,
  passenger: emptySubscribe,
  h5: emptySubscribe,
});
