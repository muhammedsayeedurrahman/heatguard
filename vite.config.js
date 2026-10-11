import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Serves the backend Lambda handlers at /api/* during `vite dev` and `vite preview`.
// Loaded via a runtime import so Node runs backend/ natively instead of bundling it into the config.
function heatguardLocalApi(env) {
  const mount = async (server) => {
    const localApiUrl = new URL('./server/localApi.js', import.meta.url).href
    const { applyEnv, createLocalApiMiddleware } = await import(/* @vite-ignore */ localApiUrl)
    applyEnv(env)
    server.middlewares.use(await createLocalApiMiddleware())
  }
  return {
    name: 'heatguard-local-api',
    configureServer: mount,
    configurePreviewServer: mount,
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Set VITE_API_BASE_URL to call a deployed API Gateway instead of the local handlers.
  const useLocalApi = !env.VITE_API_BASE_URL && env.HEATGUARD_LOCAL_API !== 'off'
  return {
    plugins: [react(), useLocalApi && heatguardLocalApi(env)],
  }
})
