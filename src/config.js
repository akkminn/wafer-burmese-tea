export const CONFIG = {
  brand: 'Wafer Dessert & Burmese Tea',
  shopName: 'ဆရာကြီး',
  siteUrl: '',
  tagline: 'A Taste of Burmese Childhood, Shared with Everyone.',
  burmeseLine: 'ဝေဖာယိုသုပ် + မြန်မာလက်ဖက်ရည်',

  event: {
    startISO: '2026-11-26T13:00:00+07:00',
    endISO: '2026-11-26T16:00:00+07:00',
    dateLabel: 'Thu, 26 Nov 2026',
    shortDate: '26 NOV',
    dayMonth: '26 Nov',
    timeLabel: '1:00 – 4:00 PM',
    place: 'Building 11, 1st floor',
    placeDetail: 'In front of the auditorium room',
    campus: 'Rangsit University',
    firstSlot: '13:00',
    lastSlot: '15:45',
    slotMinutes: 15,
  },

  prices: {
    wafer: { classic: 45, choco: 55, mixed: 50 },
    tea: 35,
    comboSaving: 5,
  },

  preorder: {
    discount: 5,
    mode: 'perItem', // or 'perOrder'
    closesISO: '2026-11-25T23:59:00+07:00',
    closesLabel: '25 Nov at 11:59 PM',
    paymentNote: 'Pre-orders are paid in advance by PromptPay QR. Send us your payment slip and we confirm it. On the day, tell us your name (or show your order code) to collect.',
  },

  payment: {
    method: 'PromptPay',
    bank: 'Bangkok Bank',
    accountName: 'MR AUNG KO KO MINN',
    promptPayId: import.meta.env.VITE_PROMPTPAY_ID || '',
  },

  orderEndpoint: import.meta.env.VITE_ORDER_ENDPOINT || '',
  lineOAId: '@976loaax',

  social: {
    instagram: '', // e.g. 'https://instagram.com/yourhandle'
    tiktok: '', // e.g. 'https://tiktok.com/@yourhandle'
    instagramHandle: '',
    tiktokHandle: '',
    lineHandle: '',
  },

  donation:
    'We will donate every baht of profit. The recipient will be announced soon.',

  allergy:
    'Our desserts contain milk and wheat, and Choco-Coco contains hazelnut. Please tell us your allergies in the order note.',
}
