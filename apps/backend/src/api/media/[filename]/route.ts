import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import path from 'node:path'

export async function GET(request: MedusaRequest, response: MedusaResponse) {
  const filename = request.params.filename
  // Unique filenames allow immutable caching alongside existing /static URLs.
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}-nord-\d+x\d+(?:-\d+)?\.(?:webp|avif)$/.test(
      filename,
    )
  ) {
    return response.status(404).json({ message: 'Изображение не найдено.' })
  }
  response.sendFile(filename, {
    root: path.resolve('static'),
    maxAge: '1y',
    immutable: true,
    headers: { 'Content-Type': filename.endsWith('.avif') ? 'image/avif' : 'image/webp' },
  })
}

export const HEAD = GET
