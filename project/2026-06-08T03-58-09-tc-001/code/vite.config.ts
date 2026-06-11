import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@smartgmp-components/sdk-provider': path.resolve(__dirname, 'src/sdk-provider'),
    },
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
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
