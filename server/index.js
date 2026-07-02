// Minimal profile server — serves the CV/profile from server/data/profile.json,
// which is NOT committed to git (see .gitignore). Zero dependencies.
//
//   node server/index.js          → http://localhost:8787/api/profile
//
// In development the Vite dev server proxies /api → this server, so the
// frontend just fetches /api/profile.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PORT = Number(process.env.PORT) || 8787
const HOST = '127.0.0.1' // local-only: never expose the profile on the network

const here = path.dirname(fileURLToPath(import.meta.url))
const PROFILE_PATH = path.join(here, 'data', 'profile.json')

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Method not allowed' })
  }
  const { pathname } = new URL(req.url, `http://${req.headers.host}`)

  if (pathname === '/api/profile') {
    try {
      const raw = await readFile(PROFILE_PATH, 'utf8')
      const profile = JSON.parse(raw) // validate before serving
      if (typeof profile.cv !== 'string' || typeof profile.profile !== 'object') {
        throw new Error('profile.json must have "cv" (string) and "profile" (object) keys')
      }
      return send(res, 200, profile)
    } catch (err) {
      const hint = err.code === 'ENOENT'
        ? 'Copy server/data/profile.example.json to server/data/profile.json and fill in your CV.'
        : err.message
      console.error(`[profile-server] ${err.message}`)
      return send(res, 500, { error: `Profile not available. ${hint}` })
    }
  }

  if (pathname === '/api/health') {
    return send(res, 200, { ok: true })
  }

  return send(res, 404, { error: 'Not found' })
})

server.listen(PORT, HOST, () => {
  console.log(`[profile-server] serving profile on http://${HOST}:${PORT}/api/profile`)
})
