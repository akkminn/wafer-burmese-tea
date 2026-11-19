import { authenticate } from '../../server/auth.js'
import { bodyObject, handle, requestId } from '../../server/handler.js'
import { sheets } from '../../server/sheets.js'

export default handle('POST', async (req, res) => {
  await authenticate(req)
  const { request_id } = bodyObject(req)
  const data = await sheets('status', { request_id: requestId(request_id) })
  return res.status(200).json({ ok: true, data })
})
