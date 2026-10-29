// Which layers get a label: one per kind, alternating between the first and last
// stack so the labels spread out. Returns 'left' | 'right' | null for each layer.
export function labelSides(layers) {
  const kinds = [...new Set(layers)]
  let flip = false
  const picked = kinds.map((k) => {
    const at = layers.map((q, i) => (q === k ? i : -1)).filter((i) => i >= 0)
    if (at.length === 1) return at[0]
    flip = !flip
    return flip ? at[0] : at[at.length - 1]
  })
  const sides = layers.map(() => null)
  picked.sort((a, b) => a - b).forEach((i, n) => {
    sides[i] = n % 2 === 0 ? 'left' : 'right'
  })
  return sides
}
