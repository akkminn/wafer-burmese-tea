import { authenticate } from '../../server/auth.js'
import { handle } from '../../server/handler.js'
import { sheets } from '../../server/sheets.js'

export default handle('GET', async (req, res) => {
  await authenticate(req)
  const data = await sheets('summary', {})
  return res.status(200).json({ ok: true, data })
})
