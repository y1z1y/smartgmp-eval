import React, { useEffect, useState } from 'react'
import { SdkProvider } from '../../sdk-provider/sdk-context'
import { builtinHtwSdk, user, kop } from '../../sdk-provider/htw-sdk'

function applyCampaignQueryParams() {
  if (typeof window === 'undefined') return
  const cfg = (window as any).__appConfig__ as { campaignId?: string; bizId?: string; simCluster?: string } | undefined
  const env = (window as any).__env__ || 'stable'
  if (!cfg?.campaignId && !cfg?.bizId && env !== 'stable') return
  const url = new URL(window.location.href)
  const isLocalPreview =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0'
  if ((isLocalPreview || !url.searchParams.has('campaignId')) && cfg.campaignId) {
    url.searchParams.set('campaignId', cfg.campaignId)
  }
  if ((isLocalPreview || !url.searchParams.has('bizId')) && cfg.bizId) {
    url.searchParams.set('bizId', cfg.bizId)
  }
  if (env === 'stable' && (isLocalPreview || !url.searchParams.has('osim'))) {
    url.searchParams.set('osim', cfg?.simCluster?.trim() || 'zjy-dev-v')
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

async function initKopFromUser(userId: string, token: string) {
  kop.instance.defaults.params = {
    ...kop.instance.defaults.params,
    userId,
    token,
  }
  const env = (window as any).__env__ || 'stable'
  const isLocalPreview =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0'
  const localProxyBaseMap: Record<string, string> = {
    stable: '/kop_osim/gateway',
    osim: '/kop_osim/gateway',
    online: '/gateway',
    pre: '/gateway',
  }
  const remoteBaseMap: Record<string, string> = {
    stable: 'https://pinzhi.didichuxing.com/kop_osim/gateway',
    osim: 'https://pinzhi.didichuxing.com/kop_osim/gateway',
    online: 'https://htwkop-st.xiaojukeji.com/gateway',
    pre: 'https://predaijiays.kuaidadi.com/gateway',
  }
  const baseMap = isLocalPreview ? localProxyBaseMap : remoteBaseMap
  kop.instance.defaults.baseURL = baseMap[env] || baseMap.stable
  const cfg = (window as any).__appConfig__ as { simCluster?: string } | undefined
  const simCluster = cfg?.simCluster?.trim()
  if (simCluster) {
    localStorage.setItem('didi-header-sim-cluster', simCluster)
    localStorage.setItem('didi-header-sim-bizType', 'htw')
    kop.instance.defaults.headers = {
      ...(kop.instance.defaults.headers || {}),
      'didi-header-sim-cluster': simCluster,
    }
  }
  await builtinHtwSdk.initWsgsdk(userId)
}

export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      applyCampaignQueryParams()
      const cfg = (window as any).__appConfig__ as { noForceLogin?: boolean } | undefined
      const noForceLogin = cfg?.noForceLogin ?? false
      let info = await user.getUserInfo()
      if (!info.login && !noForceLogin) {
        const loginResult = await user.login()
        if (loginResult && loginResult.login) {
          info = loginResult
        }
      }
      if (info.login && info.uid && info.token) {
        await initKopFromUser(info.uid, info.token)
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) return null
  return <SdkProvider>{children}</SdkProvider>
}
