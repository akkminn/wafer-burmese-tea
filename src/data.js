import { CONFIG } from './config.js'

const { prices } = CONFIG

export const FLAVORS = [
  {
    id: 'classic',
    name: 'Classic Coconut Milk',
    short: 'Classic',
    tagline: 'Creamy, sweet, and coconut-rich.',
    ingredients: 'Two stacks of 3 wafer sheets · runny milk (ယို) + coconut slices between the sheets',
    price: prices.wafer.classic,
    swatch: '#f3d77e',
  },
  {
    id: 'choco',
    name: 'Choco-Coco',
    short: 'Choco-Coco',
    tagline: 'Rich chocolate with a tropical finish.',
    ingredients: 'Two stacks of 3 wafer sheets · runny chocolate (ယို) + coconut slices. New, our own recipe',
    price: prices.wafer.choco,
    swatch: '#4a2a1c',
  },
  {
    id: 'mixed',
    name: 'Mixed-Layer',
    short: 'Mixed',
    tagline: 'The best of both fillings in one stack.',
    ingredients: 'Two stacks of 3 wafer sheets · milk and chocolate layers, each with coconut slices',
    price: prices.wafer.mixed,
    swatch: '#c9a36b',
  },
]

export const TEA = {
  id: 'tea',
  name: 'Burmese Tea',
  tagline: 'A warm, comforting cup.',
  price: prices.tea,
}

const combo = (wafer) => wafer + prices.tea - prices.comboSaving

export const COMBOS = [
  { name: 'Classic Combo', desc: 'Classic wafer + one Burmese tea', price: combo(prices.wafer.classic), add: { classic: 1, teaRegular: 1 } },
  { name: 'Choco-Coco Combo', desc: 'Choco-Coco wafer + one Burmese tea', price: combo(prices.wafer.choco), add: { choco: 1, teaRegular: 1 } },
  { name: 'Mixed-Layer Combo', desc: 'Mixed-Layer wafer + one Burmese tea', price: combo(prices.wafer.mixed), add: { mixed: 1, teaRegular: 1 } },
  { name: 'Share & Sip', desc: 'Two wafers + one Burmese tea', price: 2 * prices.wafer.classic + prices.tea - prices.comboSaving, from: true, add: { classic: 2, teaRegular: 1 } },
]

export const VIDEOS = [
  {
    id: 'tea1',
    title: 'Burmese tea and wafer, ready to go',
    src: 'videos/tea-1.mp4',
    poster: 'videos/tea-1.jpg',
    flavor: 'classic',
    cards: [],
  },
]
