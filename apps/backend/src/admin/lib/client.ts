export async function adminRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Не удалось сохранить изменения.')
  return data
}
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('files', file)
  const response = await fetch('/admin/uploads', {
    method: 'POST',
    credentials: 'include',
    body,
    signal: AbortSignal.timeout(120000),
  })
  const data = await response.json()
  if (!response.ok || !data.files?.[0]?.url)
    throw new Error(data.message || 'Не удалось загрузить изображение.')
  return data.files[0].url
}
