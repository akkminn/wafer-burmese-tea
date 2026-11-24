import { createSessionToken, verifyCredentials } from '../../server/auth.js'
import { bodyObject, handle } from '../../server/handler.js'

export default handle('POST', async (req, res) => {
  const { email, password } = bodyObject(req)
  const account = verifyCredentials(email, password)
  const token = createSessionToken(account)
  return res.status(200).json({
    ok: true,
    data: {
      token,
      email: account.email,
      can_void: account.canVoid,
    },
  })
})
