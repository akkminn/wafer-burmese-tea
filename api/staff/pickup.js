import { authenticate } from '../../server/auth.js'
import { bodyObject, handle } from '../../server/handler.js'
import { sheets } from '../../server/sheets.js'

export default handle('POST', async (req, res) => {
  const staff = await authenticate(req)
  const { code } = bodyObject(req)
  const normalized = String(code || '').trim().toUpperCase()
  if (!/^WB-[A-Z0-9]{4}$/.test(normalized)) {
    return res.status(400).json({ ok: false, error: 'Invalid pre-order code.' })
  }
  const data = await sheets('pickup', { code: normalized, staff_id: staff.email })
  return res.status(200).json({ ok: true, data })
})
