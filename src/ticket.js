import { CONFIG } from './config.js'

const W = 1080
const PAD = 70
const GREEN = '#0b5230'
const GREEN_DARK = '#073b20'
const GOLD = '#f5a30a'
const GOLD_SOFT = '#ffd36b'
const CREAM = '#fff7e3'

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function wrap(g, text, maxWidth) {
  const words = String(text).split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function makeTicket(order) {
  // the fonts must be ready before they are used on a canvas
  await Promise.all([
    document.fonts.load('900 100px Outfit'),
    document.fonts.load('800 40px Outfit'),
    document.fonts.load('700 36px Outfit'),
    document.fonts.load('400 34px Outfit'),
    document.fonts.load('500 60px "Noto Sans Myanmar"'),
  ]).catch(() => {})
  const logo = await loadImage('img/logo-sticker.webp')
  const e = CONFIG.event

  // measure first so the card is exactly as tall as it needs to be
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = '600 40px Outfit'
  const itemLines = order.items.flatMap((t) => wrap(probe, t, W - PAD * 2 - 60))
  probe.font = '400 34px Outfit'
  const placeLines = wrap(probe, `${e.place} · ${e.placeDetail}`, W - PAD * 2 - 60)
  const H = 1330 + itemLines.length * 58 + placeLines.length * 46 // fixed parts + the wrapped lines + bottom margin

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.textBaseline = 'alphabetic'

  g.fillStyle = CREAM
  g.fillRect(0, 0, W, H)

  g.fillStyle = GREEN
  g.fillRect(0, 0, W, 250)
  if (logo) {
    g.save()
    g.beginPath()
    g.arc(PAD + 80, 125, 80, 0, Math.PI * 2)
    g.clip()
    g.fillStyle = '#fff'
    g.fillRect(PAD, 45, 160, 160)
    g.drawImage(logo, PAD, 45, 160, 160)
    g.restore()
  }
  g.fillStyle = GOLD_SOFT
  g.font = '500 66px "Noto Sans Myanmar", sans-serif'
  g.fillText(CONFIG.shopName, PAD + 200, 128)
  g.fillStyle = '#fff'
  g.font = '800 38px Outfit, sans-serif'
  g.fillText(CONFIG.brand, PAD + 200, 190)

  let y = 340
  g.fillStyle = GREEN
  g.font = '700 30px Outfit, sans-serif'
  g.fillText('ORDER CODE', PAD, y)
  y += 30
  g.fillStyle = GOLD_SOFT
  g.beginPath()
  g.roundRect(PAD, y, W - PAD * 2, 190, 36)
  g.fill()
  g.fillStyle = GREEN_DARK
  g.font = '900 128px Outfit, sans-serif'
  g.textAlign = 'center'
  g.fillText(order.code, W / 2, y + 140)
  g.textAlign = 'left'
  y += 190 + 70

  const label = (t) => {
    g.fillStyle = '#6b7a70'
    g.font = '700 26px Outfit, sans-serif'
    g.fillText(t, PAD, y)
    y += 46
  }
  const value = (t, font = '800 46px Outfit, sans-serif', color = GREEN_DARK) => {
    g.fillStyle = color
    g.font = font
    g.fillText(t, PAD, y)
    y += 70
  }

  label('NAME')
  value(order.name)
  label('PICK UP')
  value(`${order.pickupDate}, ${order.slot}`)
  g.fillStyle = GREEN
  g.font = '400 34px Outfit, sans-serif'
  y -= 20
  placeLines.forEach((l) => {
    g.fillText(l, PAD, y)
    y += 46
  })
  y += 30

  label('ORDER')
  g.fillStyle = GREEN_DARK
  g.font = '600 40px Outfit, sans-serif'
  itemLines.forEach((l) => {
    g.fillText(l, PAD + 30, y)
    y += 58
  })
  y += 10

  g.strokeStyle = '#d9c99c'
  g.lineWidth = 3
  g.setLineDash([14, 12])
  g.beginPath()
  g.moveTo(PAD, y)
  g.lineTo(W - PAD, y)
  g.stroke()
  g.setLineDash([])
  y += 90
  g.fillStyle = GREEN
  g.font = '700 38px Outfit, sans-serif'
  g.fillText('Total (pre-order price)', PAD, y)
  g.textAlign = 'right'
  g.fillStyle = GREEN_DARK
  g.font = '900 84px Outfit, sans-serif'
  g.fillText(`฿${order.total}`, W - PAD, y + 6)
  g.textAlign = 'left'
  y += 80

  g.fillStyle = order.slipSent ? '#e1f5e9' : '#fff0c9'
  g.beginPath()
  g.roundRect(PAD, y, W - PAD * 2, 90, 45)
  g.fill()
  g.fillStyle = order.slipSent ? '#1d7a46' : '#8a5a00'
  g.font = '800 34px Outfit, sans-serif'
  g.textAlign = 'center'
  g.fillText(order.slipSent ? 'Payment slip sent · we will confirm it' : 'Waiting for your payment slip', W / 2, y + 58)
  g.textAlign = 'left'
  y += 90 + 70

  g.fillStyle = GREEN
  g.font = '600 32px Outfit, sans-serif'
  g.fillText('At the booth, tell us your name or show this ticket.', PAD, y)

  return c.toDataURL('image/png')
}
