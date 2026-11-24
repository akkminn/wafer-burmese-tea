// Shared by the public price display and the trusted walk-in API.
export const PRICES = Object.freeze({
  wafer: Object.freeze({ classic: 45, choco: 55, mixed: 50 }),
  tea: 35,
  comboSaving: 5,
})

export const WALK_IN_PRODUCTS = Object.freeze({
  classic: { name: 'Classic Wafer', price: PRICES.wafer.classic },
  choco: { name: 'Choco-Coco Wafer', price: PRICES.wafer.choco },
  mixed: { name: 'Mixed-Layer Wafer', price: PRICES.wafer.mixed },
  tea: { name: 'Burmese Tea', price: PRICES.tea },
})
