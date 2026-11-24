import { createHmac } from 'node:crypto'

export async function sheets(action, payload) {
  const url = process.env.WALKIN_APPS_SCRIPT_URL || process.env.VITE_ORDER_ENDPOINT
  const secret = process.env.WALKIN_APPS_SCRIPT_SECRET
  if (!url || !secret) throw Object.assign(new Error('Walk-in storage is not configured.'), { status: 503 })
  const message = JSON.stringify({ action, payload, timestamp: Date.now() })
  const signature = createHmac('sha256', secret).update(message).digest('hex')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ message, signature }),
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!response.ok) throw new Error(`Storage HTTP ${response.status}`)
    const result = await response.json()
    if (!result || typeof result.ok !== 'boolean') throw new Error('Invalid storage response')
    if (!result.ok) {
      const err = new Error(result.error || 'Storage rejected the request.')
      err.status = result.code === 'INVALID' ? 400 : result.code === 'CONFLICT' ? 409 : 503
      throw err
    }
    return result.data
  } finally {
    clearTimeout(timeout)
  }
}
