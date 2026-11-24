import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const SESSION_TTL_SECONDS = 12 * 60 * 60
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function denied(message = 'Your sign-in expired. Sign in again.') {
  return Object.assign(new Error(message), { status: 401 })
}

function digest(value) {
  return createHash('sha256').update(String(value ?? '')).digest()
}

function safeEqual(a, b) {
  return timingSafeEqual(digest(a), digest(b))
}

function sessionSecret(env = process.env) {
  return env.STAFF_SESSION_SECRET || env.WALKIN_APPS_SCRIPT_SECRET || ''
}

function isVoidRole(role) {
  return ['admin', 'manager', 'void'].includes(String(role || '').trim().toLowerCase())
}

export function parseAccounts(env = process.env) {
  const accounts = []
  const raw = (env.STAFF_ACCOUNTS || '').trim()
  if (raw) {
    if (raw.startsWith('[')) {
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw Object.assign(new Error('Staff accounts configuration is invalid.'), { status: 503 })
      }
      if (!Array.isArray(parsed)) throw Object.assign(new Error('Staff accounts configuration is invalid.'), { status: 503 })
      for (const item of parsed) {
        const email = String(item?.email || '').trim().toLowerCase()
        const password = String(item?.password ?? '')
        if (!EMAIL_PATTERN.test(email) || !password) continue
        accounts.push({ email, password, canVoid: item.canVoid === true || isVoidRole(item.role) })
      }
    } else {
      for (const entry of raw.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)) {
        const firstColon = entry.indexOf(':')
        if (firstColon < 1) continue
        const email = entry.slice(0, firstColon).trim().toLowerCase()
        let rest = entry.slice(firstColon + 1)
        let role = 'staff'
        const lastColon = rest.lastIndexOf(':')
        if (lastColon > 0) {
          const maybeRole = rest.slice(lastColon + 1).trim().toLowerCase()
          if (['admin', 'manager', 'void', 'staff'].includes(maybeRole)) {
            role = maybeRole
            rest = rest.slice(0, lastColon)
          }
        }
        if (!EMAIL_PATTERN.test(email) || !rest) continue
        accounts.push({ email, password: rest, canVoid: isVoidRole(role) })
      }
    }
  }

  const singleEmail = (env.STAFF_LOGIN_EMAIL || '').trim().toLowerCase()
  const singlePassword = env.STAFF_LOGIN_PASSWORD || ''
  if (EMAIL_PATTERN.test(singleEmail) && singlePassword && !accounts.some((a) => a.email === singleEmail)) {
    accounts.push({ email: singleEmail, password: singlePassword, canVoid: true })
  }

  return accounts
}

export function verifyCredentials(emailInput, passwordInput, env = process.env) {
  const accounts = parseAccounts(env)
  if (!accounts.length || !sessionSecret(env)) {
    throw Object.assign(new Error('Staff access is not configured.'), { status: 503 })
  }
  const email = String(emailInput || '').trim().toLowerCase()
  const password = String(passwordInput ?? '')
  if (!EMAIL_PATTERN.test(email) || !password) {
    throw denied('Enter your email and password.')
  }
  const account = accounts.find((item) => item.email === email)
  if (!account || !safeEqual(password, account.password)) {
    throw denied('Invalid email or password.')
  }
  return { email: account.email, canVoid: account.canVoid }
}

export function createSessionToken(account, env = process.env) {
  const secret = sessionSecret(env)
  if (!secret) throw Object.assign(new Error('Staff access is not configured.'), { status: 503 })
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: String(account.email).toLowerCase(),
    canVoid: Boolean(account.canVoid),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySessionToken(token, env = process.env) {
  const secret = sessionSecret(env)
  if (!secret) throw Object.assign(new Error('Staff access is not configured.'), { status: 503 })
  if (typeof token !== 'string' || token.length > 4096) throw denied()
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw denied()
  const [body, sig] = parts
  const expectedSig = createHmac('sha256', secret).update(body).digest('base64url')
  if (!safeEqual(sig, expectedSig)) throw denied()
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    throw denied()
  }
  const now = Math.floor(Date.now() / 1000)
  const email = String(payload?.sub || '').toLowerCase()
  if (!EMAIL_PATTERN.test(email) || !Number.isInteger(payload.exp) || payload.exp <= now ||
      !Number.isInteger(payload.iat) || payload.iat > now + 60) {
    throw denied()
  }
  return { email, canVoid: Boolean(payload.canVoid) }
}

export async function authenticate(req, role = 'staff') {
  const accounts = parseAccounts(process.env)
  if (!accounts.length || !sessionSecret(process.env)) {
    throw Object.assign(new Error('Staff access is not configured.'), { status: 503 })
  }
  const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '')
  if (!bearer) throw denied('Sign in to continue.')
  const session = verifySessionToken(bearer[1], process.env)
  const account = accounts.find((item) => item.email === session.email)
  if (!account) {
    throw Object.assign(new Error('This staff account is no longer active.'), { status: 403 })
  }
  if (role === 'void' && !account.canVoid) {
    throw Object.assign(new Error('You are not approved to void sales.'), { status: 403 })
  }
  return { email: account.email, canVoid: account.canVoid }
}
