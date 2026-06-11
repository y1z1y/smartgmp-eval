import './sdk-setup'
import './page-stage.css'

import React from 'react'
import { AppBootstrap } from './app-bootstrap'
import { pageComponentProps } from './page-component-props'
import HeadImg from '../../components/head-img'
import CountDown from '../../components/count-down'
import RulePopup from '../../components/rule-popup'
import ShareMask from '../../components/share-mask'
import SharePopup from '../../components/share-popup'



function usePagePreviewMock(): boolean {
  if (typeof window === 'undefined') return false
  const cfg = (window as any).__appConfig__ as { pagePreviewMock?: boolean; campaignId?: string } | undefined
  if (!cfg?.campaignId?.trim()) return true
  return cfg.pagePreviewMock !== false
}

export default function ActivityShareMarketingPage() {
  const previewMock = usePagePreviewMock()

  return (
    <AppBootstrap>
      <div className="generated-page-stage" style={{ width: '100%' }}>
        <HeadImg
          {...pageComponentProps['head-img']}
          {...(previewMock ? { __designMode: 'design' as const } : {})}
          src="https://s3-gz01.didistatic.com/packages-mait/marketing/headers/1781145047171-0606bf96.png"
        />
        <CountDown
          {...pageComponentProps['count-down']}
          {...(previewMock ? { __designMode: 'design' as const } : {})}
        />
        <RulePopup
          {...pageComponentProps['rule-popup']}
          {...(previewMock ? { __designMode: 'design' as const } : {})}
          imageConfig="https://img-hxy021.didistatic.com/static/starimg/img/ViMWDyxVax1678454844065.png"
        />
        <ShareMask
          {...pageComponentProps['share-mask']}
          {...(previewMock ? { __designMode: 'design' as const } : {})}
          imgurl="https://img-hxy021.didistatic.com/static/starimg/node/rIyEfPzFVp1678775952135.png"
        />
        <SharePopup
          {...pageComponentProps['share-popup']}
          {...(previewMock ? { __designMode: 'design' as const } : {})}
          iconImg="https://img-hxy021.didistatic.com/static/starimg/img/MkaTahZbYJ1678439403242.png"
        />
      </div>
    </AppBootstrap>
  )
}
