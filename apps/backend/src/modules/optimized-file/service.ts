import { LocalFileService } from '@medusajs/file-local'
import { createImageVariants } from '@nord/images'
import { MedusaError, promiseAll } from '@medusajs/framework/utils'
import type { FileTypes } from '@medusajs/framework/types'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { asciiUploadFilename } from '../../lib/slug'

export default class OptimizedFileService extends LocalFileService {
  static identifier = 'localfs'

  async upload(file: FileTypes.ProviderUploadFileDTO): Promise<FileTypes.ProviderFileResultDTO> {
    const filename = asciiUploadFilename(file.filename)
    if (file.access !== 'public' || !/^image\/(jpeg|png|webp|avif)$/.test(file.mimeType || ''))
      return super.upload({ ...file, filename })
    const base64 = Buffer.from(file.content, 'base64')
    const original =
      base64.toString('base64') === file.content ? base64 : Buffer.from(file.content, 'binary')
    const image = await createImageVariants(original)
    if (!image) return super.upload({ ...file, filename })
    const group = randomUUID()
    const stem = `${group}-nord-${image.width}x${image.height}`
    const key = `${stem}.webp`
    const directory = path.resolve(this.uploadDir_)
    await mkdir(directory, { recursive: true })
    const files: { name: string; data: Buffer }[] = [
      {
        name: `${group}--original${path.extname(filename).toLowerCase() || '.image'}`,
        data: original,
      },
    ]
    for (const variant of image.variants) {
      const name = variant.width === image.width ? stem : `${stem}-${variant.width}`
      files.push(
        { name: `${name}.webp`, data: variant.webp },
        { name: `${name}.avif`, data: variant.avif },
      )
    }
    try {
      // Wait for every write before cleaning up a failed upload.
      await promiseAll(files.map((file) => writeFile(path.join(directory, file.name), file.data)))
    } catch {
      await Promise.allSettled(files.map((file) => unlink(path.join(directory, file.name))))
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'Не удалось сохранить обработанные изображения.',
      )
    }
    const mediaUrl = this.backendUrl_.replace(/\/static\/?$/, '/media').replace(/\/$/, '')
    return { key, url: `${mediaUrl}/${key}` }
  }

  async delete(input: FileTypes.ProviderDeleteFileDTO | FileTypes.ProviderDeleteFileDTO[]) {
    const files = Array.isArray(input) ? input : [input]
    const groups = new Set<string>()
    const ordinary: FileTypes.ProviderDeleteFileDTO[] = []
    for (const file of files) {
      const group = file.fileKey.match(/^([\da-f-]{36})-nord-\d+x\d+\.webp$/)?.[1]
      if (group) groups.add(group)
      else ordinary.push(file)
    }
    if (!groups.size) return super.delete(ordinary)
    const directory = path.resolve(this.uploadDir_)
    const entries = await readdir(directory).catch((error) => {
      if (error.code !== 'ENOENT') throw error
      return [] as string[]
    })
    const related = entries.filter((name) => {
      if (!groups.has(name.slice(0, 36))) return false
      const suffix = name.slice(36)
      return suffix.startsWith('-nord-') || suffix.startsWith('--original.')
    })
    await promiseAll([
      super.delete(ordinary),
      ...related.map((name) =>
        unlink(path.join(directory, name)).catch((error) => {
          if (error.code !== 'ENOENT') throw error
        }),
      ),
    ])
  }
}
