const MAX_FILE_MB = 15

export async function compressImage(file, maxSide = 1400, quality = 0.72) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose a picture (JPG or PNG screenshot).')
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`That picture is over ${MAX_FILE_MB} MB. Please choose a smaller one.`)
  let bmp
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error('We could not open that picture. Please use a JPG or PNG screenshot.')
  }
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * k)
  canvas.height = Math.round(bmp.height * k)
  const g = canvas.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('We could not prepare that picture. Please try another one.')
  return blob
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error('Could not read the picture.'))
    r.readAsDataURL(blob)
  })
}

/**
 * Posts JSON to the Apps Script web app.
 * Returns { ok: true } when the script answered, { ok: false, error } when it answered with an error,
 * and { ok: true, unverified: true } when the browser hid the answer (it was still sent).
 */
export async function postJSON(url, payload) {
  const body = JSON.stringify(payload)
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' }
  try {
    const res = await fetch(url, { method: 'POST', headers, body })
    const data = await res.json().catch(() => null)
    if (data && data.ok === false) return { ok: false, error: data.error || 'The server said no.' }
    return { ok: true }
  } catch {
    // Most likely the browser blocked reading the answer; send once more so the request is surely out (the script ignores duplicates by code).
    await fetch(url, { method: 'POST', mode: 'no-cors', headers, body })
    return { ok: true, unverified: true }
  }
}
