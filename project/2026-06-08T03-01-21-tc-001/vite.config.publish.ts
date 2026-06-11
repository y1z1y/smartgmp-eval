import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const pagesDir = path.resolve(__dirname, 'src/pages')

function getPageEntries(): Record<string, string> {
  const entries: Record<string, string> = {}
  if (!fs.existsSync(pagesDir)) return entries

  for (const name of fs.readdirSync(pagesDir)) {
    const htmlPath = path.join(pagesDir, name, 'index.html')
    if (fs.existsSync(htmlPath)) {
      entries[name] = path.resolve(pagesDir, name, 'index.html')
    }
  }
  return entries
}

export default defineConfig({
  root: pagesDir,
  base: './',
  resolve: {
    alias: {
      '@smartgmp-components/sdk-provider': path.resolve(__dirname, 'src/sdk-provider'),
    },
  },
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 1_000_000,
    target: 'esnext',
    rollupOptions: {
      input: getPageEntries(),
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
})
