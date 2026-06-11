/**
 * SkyWalker 项目入口。
 *
 * 路由规则：
 *   /                → 显示所有页面列表
 *   /pages/<name>    → 渲染 src/pages/<name>/index.tsx
 *   ?page=<name>     → 同上（preview-server 用）
 *
 * 不依赖 react-router，用原生 URL 解析实现零依赖路由。
 */
import React, { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AdaptiveContainer } from './components/AdaptiveContainer'

// Vite 的 import.meta.glob 自动发现所有页面
const pageModules = import.meta.glob<{ default: React.ComponentType }>(
  './pages/*/index.tsx',
)

// 提取页面名：'./pages/reward-dialog/index.tsx' → 'reward-dialog'
function getPageNames(): string[] {
  return Object.keys(pageModules)
    .map((p) => p.match(/\.\/pages\/([^/]+)\/index\.tsx/)?.[1])
    .filter(Boolean) as string[]
}

function getRequestedPage(): string | null {
  // ?page=xxx 优先（preview-server 用）
  const params = new URLSearchParams(location.search)
  const fromQuery = params.get('page')
  if (fromQuery) return fromQuery

  // /pages/xxx 路径
  const pathMatch = location.pathname.match(/\/pages\/([a-zA-Z0-9_-]+)/)
  if (pathMatch) return pathMatch[1]

  return null
}

function PageRenderer({ name }: { name: string }) {
  const modulePath = `./pages/${name}/index.tsx`
  const loader = pageModules[modulePath]

  if (!loader) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
        <h2>页面不存在: {name}</h2>
        <p>可用页面：{getPageNames().join(', ') || '暂无'}</p>
      </div>
    )
  }

  const LazyPage = lazy(loader)
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>}>
      <LazyPage />
    </Suspense>
  )
}

function PageList() {
  const pages = getPageNames()
  return (
    <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>SkyWalker 项目页面</h1>
      {pages.length === 0 ? (
        <p style={{ color: '#999' }}>暂无页面。在对话中让 AI 生成一个页面吧。</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {pages.map((name) => (
            <li key={name} style={{ marginBottom: 8 }}>
              <a
                href={`/pages/${name}`}
                style={{ display: 'block', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb', textDecoration: 'none', color: '#333', fontSize: 14 }}
              >
                📄 {name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function App() {
  const [page, setPage] = useState<string | null>(getRequestedPage)

  useEffect(() => {
    const onChange = () => setPage(getRequestedPage())
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])

  if (page) return (
    <AdaptiveContainer>
      <PageRenderer name={page} />
    </AdaptiveContainer>
  )
  return <PageList />
}

createRoot(document.getElementById('root')!).render(<App />)
