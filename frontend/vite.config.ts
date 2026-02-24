import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://localhost:9090'

  return {
    plugins: [react()],
    define: {
      global: 'window',
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
        },
        '/ws': {
          target: backendOrigin,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
