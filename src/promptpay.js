const tlv = (tag, value) => tag + String(value.length).padStart(2, '0') + value

/** CRC-16/CCITT-FALSE, the checksum Thai QR uses */
function crc16(text) {
  let crc = 0xffff
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function promptPayPayload(target, amount) {
  const digits = String(target).replace(/\D/g, '')
  const mobile = digits.length <= 10
  const id = mobile ? '0066' + digits.replace(/^0/, '') : digits
  const account = tlv('00', 'A000000677010111') + tlv(mobile ? '01' : '02', id)
  let p = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('29', account) + tlv('53', '764')
  if (amount) p += tlv('54', Number(amount).toFixed(2))
  p += tlv('58', 'TH') + '6304'
  return p + crc16(p)
}
