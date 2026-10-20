import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, configDir, '')
  const proxy = env.VITE_API_PROXY_TARGET
    ? {
        '/api': {
          target: env.VITE_API_PROXY_TARGET,
          changeOrigin: true,
        },
      }
    : undefined

  return {
    plugins: [react()],
    ...(mode === 'development' && proxy ? { server: { proxy } } : {}),
  }
})
