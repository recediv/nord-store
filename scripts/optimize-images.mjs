import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createImageVariants } from '@nord/images'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = path.join(root, 'apps/backend/static')
const filenames = await fs.readdir(directory)
const mainFiles = new Map()
for (const name of filenames) {
  const match = name.match(/^([\da-f-]{36})-nord-(\d+)x(\d+)\.webp$/)
  if (match) mainFiles.set(match[1], { name, width: Number(match[2]), height: Number(match[3]) })
}
let count = 0
for (const originalName of filenames.filter((name) => /^[\da-f-]{36}--original\./.test(name))) {
  const group = originalName.slice(0, 36)
  const main = mainFiles.get(group)
  if (!main) continue
  const image = await createImageVariants(await fs.readFile(path.join(directory, originalName)))
  if (!image || image.width !== main.width || image.height !== main.height)
    throw new Error(`Размер оригинала не совпал с опубликованным изображением ${main.name}`)
  const stem = main.name.replace(/\.webp$/, '')
  for (const variant of image.variants) {
    const name = variant.width === image.width ? stem : `${stem}-${variant.width}`
    await Promise.all([
      fs.writeFile(path.join(directory, name + '.webp'), variant.webp),
      fs.writeFile(path.join(directory, name + '.avif'), variant.avif),
    ])
  }
  count++
  if (count % 6 === 0) console.log(JSON.stringify({ uploadedImagesProcessed: count }))
}
console.log(JSON.stringify({ uploadedImagesProcessed: count }))
