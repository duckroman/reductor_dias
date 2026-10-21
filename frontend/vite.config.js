import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, configDir, '')
  const proxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  }

  return {
    plugins: [react()],
    ...(mode === 'development' && proxy ? { server: { proxy } } : {}),
  }
})
