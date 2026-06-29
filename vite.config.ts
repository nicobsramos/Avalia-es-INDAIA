import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Connect } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sheets-dev-proxy',
      configureServer(server) {
        server.middlewares.use(
          '/api/sheets',
          (async (_req: Connect.IncomingMessage, res: any) => {
            try {
              const r = await fetch(
                'https://docs.google.com/spreadsheets/d/1Bkfo0-1N85Ee8epGplPvB_VUe6Ri7fjdg13fvtAOaq8/export?format=csv&gid=907174208'
              )
              const text = await r.text()
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end(text)
            } catch {
              res.statusCode = 500
              res.end('error')
            }
          }) as Connect.NextHandleFunction
        )
      },
    },
  ],
})
