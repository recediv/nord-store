import type { IFileModuleService } from '@medusajs/framework/types'
import { logger } from '@medusajs/framework/logger'
import { MedusaError, normalizeCSVValue } from '@medusajs/framework/utils'
import { CsvError, parse } from 'csv-parse'
import { stringify } from 'csv-stringify'
import { randomUUID } from 'node:crypto'
import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { asciiHandle } from './slug'

/** Preserve column order and raw string values. */
function handleTransform(changed: () => void) {
  let header = true
  let handleColumn = -1
  const handles = new Map<string, string>()
  return new Transform({
    objectMode: true,
    transform(row: string[], _encoding, done) {
      try {
        if (header) {
          header = false
          // csv-parse first merges identical headers; preProcess then lowers keys.
          const columns = new Map(row.map((name, index) => [name, index]))
          for (const [name, index] of columns)
            if (normalizeCSVValue(name).toLowerCase() === 'product handle') handleColumn = index
        } else if (handleColumn !== -1) {
          const original = normalizeCSVValue(row[handleColumn])
          if (original) {
            const handle = /[^\x00-\x7f]/.test(original) ? asciiHandle(original) : original
            const previous = handles.get(handle)
            if (previous !== undefined && previous !== original)
              throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `Адреса товаров «${previous}» и «${original}» после транслитерации совпадают: ${handle}. Укажите разные Product Handle.`,
              )
            handles.set(handle, original)
            if (handle !== original) {
              row[handleColumn] = handle
              changed()
            }
          }
        }
        done(null, row)
      } catch (error) {
        done(error as Error)
      }
    },
  })
}

function csvError(error: unknown): never {
  if (error instanceof CsvError)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message)
  throw error
}

async function needsTransliteration(source: Readable, delimiter = ','): Promise<boolean> {
  let changed = false
  try {
    await pipeline(
      source,
      parse({ delimiter, skip_empty_lines: true }),
      handleTransform(() => {
        changed = true
      }),
      new Writable({
        objectMode: true,
        write(_row, _encoding, done) {
          done()
        },
      }),
    )
  } catch (error) {
    csvError(error)
  }
  return changed
}

function writeTransliteratedCsv(source: Readable, destination: Writable, delimiter = ',') {
  return pipeline(
    source,
    parse({ delimiter, skip_empty_lines: true }),
    handleTransform(() => {}),
    stringify({ delimiter }),
    destination,
  )
}

/** Remove only the prepared CSV; native workflows own chunk files. */
export async function removePreparedImportCsv(file: IFileModuleService, fileKey: string) {
  try {
    await file.deleteFiles(fileKey)
  } catch (error) {
    logger.warn(`Не удалось удалить временный CSV импорта ${fileKey}: ${String(error)}`)
  }
}

export async function prepareProductImportCsv(
  file: IFileModuleService,
  fileKey: string,
): Promise<string | null> {
  if (!(await needsTransliteration(await file.getDownloadStream(fileKey)))) return null
  const upload = await file.getUploadStream({
    filename: `nord-import-${randomUUID()}.csv`,
    mimeType: 'text/csv',
    access: 'private',
  })
  // Capture upload failures before opening the input stream.
  const uploaded = Promise.allSettled([upload.promise])
  try {
    const source = await file.getDownloadStream(fileKey)
    await writeTransliteratedCsv(source, upload.writeStream)
    const [result] = await uploaded
    if (result.status === 'rejected') throw result.reason
    return upload.fileKey
  } catch (error) {
    upload.writeStream.destroy(error instanceof Error ? error : new Error(String(error)))
    await uploaded
    await removePreparedImportCsv(file, upload.fileKey)
    csvError(error)
  }
}

/** Reuse CSV normalization for the legacy buffered import. */
export async function transliterateProductImportBuffer(input: Buffer): Promise<Buffer> {
  // Match native convertCsvToJson delimiter selection.
  const header = input.toString('utf8').split('\n', 1)[0]
  const delimiter = [',', ';', '|'].find((value) => header.includes(value)) || ','
  if (!(await needsTransliteration(Readable.from([input]), delimiter))) return input
  const chunks: Buffer[] = []
  try {
    await writeTransliteratedCsv(
      Readable.from([input]),
      new Writable({
        write(chunk, _encoding, done) {
          chunks.push(Buffer.from(chunk))
          done()
        },
      }),
      delimiter,
    )
  } catch (error) {
    csvError(error)
  }
  return Buffer.concat(chunks)
}
