import { getAllQuery } from './url';
import { getEnv, getQjChannel } from './xenv';

export interface OmegaConfig {
  appKey?: string;
  userId?: number;
  attrs: Record<string, string | number>;
}

export const YKS_OMEGA_APP_KEY = 'omega38ab07d99c';

export const getFromPage = (): string => {
  const val: string | null = sessionStorage.getItem('pub_qj_from_page');
  if (val && val !== 'undefined') return val;
  const query = getAllQuery(window.location.href);
  let pubQjFromPage = 'no_source_page';
  if (query.pub_qj_from_page) {
    pubQjFromPage = decodeURIComponent(query.pub_qj_from_page);
  }
  return pubQjFromPage;
};

export async function initOmegaDefaultAttrs(
  params: Record<string, string> = {},
): Promise<undefined> {
  const {
    xenv = '',
    dchn = '',
    ddchn = '',
    campaignId = '',
    bizId = '',
    pub_qj_out_source = 'other',
    pub_qj_ddchn = '',
    pub_qj_from_spot = '',
    pub_qj_from_content = '',
    xpsid_root = '0',
  } = getAllQuery(window.location.href);
  const env = getEnv();

  if (bizId === '901') {
    const config: OmegaConfig = {
      appKey: YKS_OMEGA_APP_KEY,
      attrs: { xenv, dchn, campaign_id: campaignId, env, ...params },
    };
    (window as any).Omega?.setConfig(config);
    return;
  }

  const config: OmegaConfig = {
    attrs: {
      ddchn,
      campaign_id: campaignId,
      env,
      biz_id: bizId,
      activity_name: window.document.title || '',
      pub_qj_out_source: decodeURIComponent(pub_qj_out_source),
      pub_qj_ddchn: decodeURIComponent(ddchn || pub_qj_ddchn),
      pub_qj_from_spot: decodeURIComponent(pub_qj_from_spot),
      pub_qj_from_content: decodeURIComponent(pub_qj_from_content),
      xpsid_root: decodeURIComponent(xpsid_root) || '0',
      pub_qj_channel: getQjChannel,
      pub_qj_from_page: getFromPage(),
      pub_qj_current_page: window.document.title || '',
      is_magic_cube: 1,
      ...params,
    },
  };
  (window as any).Omega?.setConfig(config);
}
