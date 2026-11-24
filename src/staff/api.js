export async function staffApi(path, token, body) {
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  }
  const response = await fetch(`/api/staff/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
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

export function staffLogin(email, password) {
  return staffApi('login', null, { email, password })
}
