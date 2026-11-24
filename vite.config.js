import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

function staffDevPlugin() {
  return {
    name: 'staff-dev-server',
    configureServer(server) {
      const env = loadEnv(server.config.mode, root, '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        const urlPath = (req.url || '').split('?')[0]

        if (urlPath === '/staff/walk-in') {
          res.statusCode = 302
          res.setHeader('Location', '/staff/walk-in/')
          res.end()
          return
        }

        const apiMatch = /^\/api\/staff\/([a-z0-9-]+)$/.exec(urlPath)
        if (!apiMatch) return next()

        const file = resolve(root, `api/staff/${apiMatch[1]}.js`)
        if (!existsSync(file)) return next()

        try {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const raw = Buffer.concat(chunks).toString('utf8')
            if (raw) {
              try {
                req.body = JSON.parse(raw)
              } catch {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body.' }))
                return
              }
            }
          }

          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (data) => {
            if (!res.headersSent) res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
            return res
          }

          const mod = await server.ssrLoadModule(`/api/staff/${apiMatch[1]}.js`)
          await mod.default(req, res)
        } catch (err) {
          server.ssrFixStacktrace(err)
          console.error('Dev Staff API error:', err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'Dev server error.' }))
          }
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), staffDevPlugin()],
  // './' lets the built site work from any folder or subpath (Netlify, GitHub Pages, a USB stick)
  base: './',
  // one copy of React for the 3D library and the app
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['three', '@react-three/fiber'] },
  build: {
    rollupOptions: {
      input: {
        public: resolve(root, 'index.html'),
        staff: resolve(root, 'staff/walk-in/index.html'),
      },
    },
  },
})
