import { authenticate } from '../../server/auth.js'
import { bodyObject, handle } from '../../server/handler.js'
import { sheets } from '../../server/sheets.js'

export default handle('POST', async (req, res) => {
  const staff = await authenticate(req, 'void')
  const { sale_id, reason } = bodyObject(req)
  if (typeof sale_id !== 'string' || !/^WI-[A-Z0-9-]{8,50}$/.test(sale_id)) {
    return res.status(400).json({ ok: false, error: 'Invalid sale ID.' })
  }
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 300) {
    return res.status(400).json({ ok: false, error: 'Enter a reason of at least 5 characters.' })
  }
  const data = await sheets('void', { sale_id, reason: reason.trim(), staff_id: staff.email })
  return res.status(200).json({ ok: true, data })
})
