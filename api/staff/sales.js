import { authenticate } from '../../server/auth.js'
import { handle } from '../../server/handler.js'
import { sheets } from '../../server/sheets.js'

export default handle('GET', async (req, res) => {
  const staff = await authenticate(req)
  const data = await sheets('sales', { limit: 30 })
  return res.status(200).json({ ok: true, data: { ...data, can_void: staff.canVoid } })
})
