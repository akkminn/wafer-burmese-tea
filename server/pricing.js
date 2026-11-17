import { PRICES, WALK_IN_PRODUCTS } from '../src/catalog.js'

export const PRODUCT_IDS = Object.keys(WALK_IN_PRODUCTS)

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 })
}

export function validateCart(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Invalid cart.')
  if (Object.keys(input).some((id) => !PRODUCT_IDS.includes(id))) invalid('Unknown product.')
  const cart = {}
  for (const id of PRODUCT_IDS) {
    const quantity = input[id] ?? 0
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) invalid('Quantities must be whole numbers from 0 to 20.')
    cart[id] = quantity
  }
  if (!Object.values(cart).some(Boolean)) invalid('Add at least one item.')
  return cart
}

export function calculateSale(input) {
  const cart = validateCart(input)
  const items = PRODUCT_IDS.filter((id) => cart[id]).map((id) => ({
    product_id: id,
    product_name: WALK_IN_PRODUCTS[id].name,
    quantity: cart[id],
    unit_price: WALK_IN_PRODUCTS[id].price,
    line_total: cart[id] * WALK_IN_PRODUCTS[id].price,
  }))
  const raw = items.reduce((sum, item) => sum + item.line_total, 0)
  const wafers = cart.classic + cart.choco + cart.mixed
  const teas = cart.teaRegular + cart.teaLess
  const combo_discount = Math.min(wafers, teas) * PRICES.comboSaving
  return { cart, items, subtotal: raw, combo_discount, total: raw - combo_discount }
}
