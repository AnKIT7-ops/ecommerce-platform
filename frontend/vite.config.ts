import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Where the FastAPI backend listens. Only used to proxy dev requests.
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Vite does not read PORT on its own. Honour it so a supervisor can assign
    // a free port; fall back to the conventional 5173 for a plain `npm run dev`.
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    // Serve the API from this same origin in dev. Without it the browser origin
    // has to appear in the backend's CORS_ORIGINS allowlist, which pins the dev
    // server to one hardcoded port. The backend already mounts its routes under
    // /api, so the path passes through unchanged.
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
    },
  },
})
