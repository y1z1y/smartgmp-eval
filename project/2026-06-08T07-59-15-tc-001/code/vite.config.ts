import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom', 'jotai'],
    alias: {
      '@didi/webx-js-web': path.resolve(__dirname, 'src/stubs/webx-js-web.ts'),
      '@didi/webx-js': path.resolve(__dirname, 'src/stubs/webx-js.ts'),
    },
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      '/kop_osim': {
        target: 'https://pinzhi.didichuxing.com',
        changeOrigin: true,
        secure: false,
      },
      '/gateway': {
        target: 'https://htwkop-st.xiaojukeji.com',
        changeOrigin: true,
        secure: false,
      },
      '/passport-sdk': {
        target: 'https://passport-test.didichuxing.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/passport-sdk/, '/static/trinity-login/2.3.0'),
      },
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
})
