import { createPublicKey, verify } from 'node:crypto'

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
let keysCache = { expires: 0, keys: [] }

function emails(value) {
  return new Set((value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))
}

function denied(message = 'Your sign-in expired. Sign in again.') {
  return Object.assign(new Error(message), { status: 401 })
}

async function googleKeys() {
  if (Date.now() < keysCache.expires && keysCache.keys.length) return keysCache.keys
  const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(7000) })
  if (!response.ok) throw new Error('Could not retrieve Google signing keys.')
  const data = await response.json()
  if (!Array.isArray(data.keys)) throw new Error('Invalid Google signing keys.')
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 300)
  keysCache = { keys: data.keys, expires: Date.now() + Math.min(maxAge, 3600) * 1000 }
  return keysCache.keys
}

export async function verifyGoogleToken(token, clientId) {
  if (typeof token !== 'string' || token.length > 10000) throw denied()
  const pieces = token.split('.')
  if (pieces.length !== 3) throw denied()
  let header, payload
  try {
    header = JSON.parse(Buffer.from(pieces[0], 'base64url').toString('utf8'))
    payload = JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8'))
  } catch {
    throw denied()
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw denied()
  const key = (await googleKeys()).find((item) => item.kid === header.kid && item.kty === 'RSA' && item.use === 'sig')
  if (!key) throw denied()
  let valid = false
  try {
    valid = verify('RSA-SHA256', Buffer.from(`${pieces[0]}.${pieces[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(pieces[2], 'base64url'))
  } catch {
    throw denied()
  }
  const now = Math.floor(Date.now() / 1000)
  if (!valid || payload.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) ||
      !Number.isInteger(payload.exp) || payload.exp <= now || !Number.isInteger(payload.iat) || payload.iat > now + 60 ||
      (payload.nbf != null && payload.nbf > now) || typeof payload.sub !== 'string' || !payload.sub || payload.email_verified !== true) {
    throw denied()
  }
  return payload
}

export async function authenticate(req, role = 'staff') {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId || !process.env.STAFF_ALLOWED_EMAILS) throw Object.assign(new Error('Staff access is not configured.'), { status: 503 })
  const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '')
  if (!bearer) throw denied('Sign in with Google.')
  const payload = await verifyGoogleToken(bearer[1], clientId)
  const email = String(payload.email || '').toLowerCase()
  if (!emails(process.env.STAFF_ALLOWED_EMAILS).has(email)) {
    throw Object.assign(new Error('This Google account is not approved for staff access.'), { status: 403 })
  }
  if (role === 'void' && !emails(process.env.STAFF_VOID_EMAILS).has(email)) {
    throw Object.assign(new Error('You are not approved to void sales.'), { status: 403 })
  }
  return { email, canVoid: emails(process.env.STAFF_VOID_EMAILS).has(email) }
}
