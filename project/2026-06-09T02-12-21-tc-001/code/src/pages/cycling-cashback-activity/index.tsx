import './sdk-setup'
import './page-stage.css'

import React from 'react'
import { AppBootstrap } from './app-bootstrap'
import { pageComponentProps } from './page-component-props'
import HeadImg from '../../components/head-img'
import QjCashback from '../../components/qj-cashback'



function usePagePreviewMock(): boolean {
  if (typeof window === 'undefined') return false
  const cfg = (window as any).__appConfig__ as { pagePreviewMock?: boolean; campaignId?: string } | undefined
  if (!cfg?.campaignId?.trim()) return true
  return cfg.pagePreviewMock !== false
}

export default function CyclingCashbackActivityPage() {
  const previewMock = usePagePreviewMock()

  return (
    <AppBootstrap>
      <div className="generated-page-stage" style={{ width: '100%' }}>
        <HeadImg
          {...pageComponentProps['head-img']}
          {...(previewMock ? { __designMode: 'design' as const } : {})}
          src="https://img-saas-ice.didistatic.com/customer/2c9662d1a32c4521ae44c289f8ba0a17_1749442982638.png"
        />
        <QjCashback
          {...pageComponentProps['qj-cashback']}
          {...(previewMock ? { __designMode: 'design' as const } : {})}
        />
      </div>
    </AppBootstrap>
  )
}
