import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { asciiHandle } from '../../lib/slug'

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeHandle(value: unknown, title: 'title' | 'name', creating: boolean) {
  if (!record(value)) return
  const handle = value.handle
  if (typeof handle === 'string' && (!creating || handle.trim())) {
    value.handle = asciiHandle(handle)
  } else if (creating && (handle === undefined || typeof handle === 'string')) {
    const fallback = value[title]
    if (typeof fallback === 'string' && fallback.trim()) value.handle = asciiHandle(fallback)
  }
}

function transformBodies(req: MedusaRequest, transform: (body: unknown) => void) {
  // Native validators may create a separate body; normalize both copies.
  transform(req.body)
  if (req.validatedBody !== req.body) transform(req.validatedBody)
}

export function normalizeAdminHandle(title: 'title' | 'name', creating = false) {
  return (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    transformBodies(req, (body) => normalizeHandle(body, title, creating))
    next()
  }
}

export function normalizeAdminProductBatchHandles(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  transformBodies(req, (body) => {
    if (!record(body)) return
    if (Array.isArray(body.create))
      body.create.forEach((product) => normalizeHandle(product, 'title', true))
    if (Array.isArray(body.update))
      body.update.forEach((product) => normalizeHandle(product, 'title', false))
  })
  next()
}
