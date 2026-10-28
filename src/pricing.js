import { CONFIG } from './config.js'
import { FLAVORS } from './data.js'

const { prices, preorder } = CONFIG

export const EMPTY_CART = {
  classic: 0,
  choco: 0,
  mixed: 0,
  teaRegular: 0,
  teaLess: 0,
}

const n = (v) => Number(v) || 0

export function priceCart(cart, { isPreorder = true } = {}) {
  const waferCount = n(cart.classic) + n(cart.choco) + n(cart.mixed)
  const teaCount = n(cart.teaRegular) + n(cart.teaLess)
  const pairs = Math.min(waferCount, teaCount)

  const waferTotal = n(cart.classic) * prices.wafer.classic + n(cart.choco) * prices.wafer.choco + n(cart.mixed) * prices.wafer.mixed
  const teaTotal = teaCount * prices.tea
  const comboSaving = pairs * prices.comboSaving
  const subtotal = waferTotal + teaTotal - comboSaving

  const items = waferCount + teaCount
  const discountedItems = items
  let discount = 0
  if (isPreorder && discountedItems > 0) {
    discount = preorder.mode === 'perOrder' ? preorder.discount : preorder.discount * discountedItems
    discount = Math.min(discount, subtotal)
  }

  return {
    items,
    waferCount,
    teaCount,
    pairs,
    waferTotal,
    teaTotal,
    comboSaving,
    subtotal,
    discount,
    discountedItems,
    total: subtotal - discount,
  }
}

export function cartLines(cart) {
  const lines = []
  for (const f of FLAVORS) if (cart[f.id] > 0) lines.push({ key: f.id, qty: cart[f.id], label: `${f.name} wafer` })
  if (cart.teaRegular > 0) lines.push({ key: 'teaRegular', qty: cart.teaRegular, label: 'Burmese Tea (regular)' })
  if (cart.teaLess > 0) lines.push({ key: 'teaLess', qty: cart.teaLess, label: 'Burmese Tea (less sweet)' })
  return lines
}

export function preorderOpen(now = new Date()) {
  if (!preorder.closesISO) return true
  return now < new Date(preorder.closesISO)
}

export function pickupSlots() {
  const { firstSlot, lastSlot, slotMinutes } = CONFIG.event
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
  const fmt = (m) => {
    const h = Math.floor(m / 60)
    const mm = String(m % 60).padStart(2, '0')
    const h12 = ((h + 11) % 12) + 1
    return `${h12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`
  }
  const out = []
  for (let m = toMin(firstSlot); m <= toMin(lastSlot); m += slotMinutes) out.push(fmt(m))
  return out
}

export function makeOrderCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `WB-${s}`
}
