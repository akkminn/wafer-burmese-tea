export async function staffApi(path, token, body) {
  const response = await fetch(`/api/staff/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.error || 'Could not reach the sale service.')
    error.status = response.status
    throw error
  }
  return result.data
}
