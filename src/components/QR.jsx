import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CONFIG } from '../config.js'

export function siteUrl() {
  if (CONFIG.siteUrl) return CONFIG.siteUrl
  return typeof window === 'undefined' ? '' : window.location.href.split('#')[0]
}

export default function QR({ size = 160, className = '' }) {
  const [svg, setSvg] = useState('')
  const url = siteUrl()
  useEffect(() => {
    let live = true
    QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#0b5230', light: '#ffffff' } }).then((s) => live && setSvg(s))
    return () => {
      live = false
    }
  }, [url])
  return (
    <div
      className={`qr ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR code for ${url}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export async function downloadQR() {
  const dataUrl = await QRCode.toDataURL(siteUrl(), { width: 1200, margin: 2, color: { dark: '#0b5230', light: '#ffffff' } })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = 'wafer-tea-preorder-qr.png'
  a.click()
}
