export function handle(method, fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== method) {
      res.setHeader('Allow', method)
      return res.status(405).json({ ok: false, error: 'Method not allowed.' })
    }
    try {
      return await fn(req, res)
    } catch (error) {
      const status = error.status || 500
      if (status >= 500) console.error('Staff API error:', error)
      return res.status(status).json({ ok: false, error: status >= 500 ? 'Sale service unavailable. Check the request status before retrying.' : error.message })
    }
  }
}

export function bodyObject(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw Object.assign(new Error('Invalid request body.'), { status: 400 })
  }
  return req.body
}

export function requestId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/i.test(value)) {
    throw Object.assign(new Error('Invalid request ID.'), { status: 400 })
  }
  return value
}
