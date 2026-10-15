import { MedusaError } from '@medusajs/framework/utils'
import path from 'node:path'
import slugify from 'slugify'

function asciiSlug(value: string): string {
  return slugify(value.replace(/_/g, ' '), {
    lower: true,
    strict: true,
    trim: true,
  })
}

/** Transliterate public handles without changing display text. */
export function asciiHandle(value: string): string {
  const handle = asciiSlug(value)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle))
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Не удалось сформировать URL. Укажите адрес с буквами или цифрами.',
    )
  return handle
}

/** Transliterate new upload names; the provider adds the unique prefix. */
export function asciiUploadFilename(value: string): string {
  const filename = path.basename(value)
  if (!/[^\x00-\x7f]/.test(filename)) return filename
  const { name, ext } = path.parse(filename)
  const extension = /[^\x00-\x7f]/.test(ext) ? asciiSlug(ext.slice(1)) : ext.slice(1)
  return `${asciiSlug(name) || 'file'}${extension ? `.${extension}` : ''}`
}
