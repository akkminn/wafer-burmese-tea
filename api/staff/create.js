import { authenticate } from '../../server/auth.js'
import { bodyObject, handle, requestId } from '../../server/handler.js'
import { calculateSale } from '../../server/pricing.js'
import { sheets } from '../../server/sheets.js'

export default handle('POST', async (req, res) => {
  const staff = await authenticate(req)
  const body = bodyObject(req)
  const request_id = requestId(body.request_id)
  if (!['Cash', 'PromptPay'].includes(body.payment_method)) {
    return res.status(400).json({ ok: false, error: 'Choose Cash or PromptPay.' })
  }
  if (body.payment_confirmed !== true) {
    return res.status(400).json({ ok: false, error: 'Confirm that payment was received.' })
  }
  const sale = calculateSale(body.cart)
  const data = await sheets('create', { request_id, staff_id: staff.email, payment_method: body.payment_method, ...sale })
  return res.status(200).json({ ok: true, data })
})
