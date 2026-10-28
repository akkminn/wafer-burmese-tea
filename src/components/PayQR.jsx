import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CONFIG } from '../config.js'
import { promptPayPayload } from '../promptpay.js'

export default function PayQR({ amount, code }) {
  const { promptPayId, accountName, bank } = CONFIG.payment
  const payload = promptPayPayload(promptPayId, amount)
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let live = true
    QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b3d6b', light: '#ffffff' } }).then((s) => live && setSvg(s))
    return () => {
      live = false
    }
  }, [payload])

  const save = async () => {
    const dataUrl = await QRCode.toDataURL(payload, { width: 900, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#0b3d6b', light: '#ffffff' } })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `pay-${code}-${amount}baht.png`
    a.click()
  }

  return (
    <div className="pay-qr">
      <div className="pay-qr-img" role="img" aria-label={`PromptPay QR code for ${amount} baht`} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="pay-qr-info">
        <b>฿{amount}</b>
        <span>{CONFIG.payment.method} · {bank}</span>
        <span>{accountName}</span>
        <button type="button" className="linklike" onClick={save}>Save QR to my phone</button>
      </div>
    </div>
  )
}
