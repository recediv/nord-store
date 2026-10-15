const sharp = require('sharp')
const widthsForImages = require('./widths.json')

async function createImageVariants(buffer, options = {}) {
  const image = sharp(buffer, { limitInputPixels: 50000000 }).rotate().toColourspace('srgb')
  const metadata = await image.metadata()
  if ((metadata.pages || 1) > 1) return null
  const { data, info } = await image
    .resize({
      width: options.maxWidth || 1440,
      height: options.maxHeight || 2160,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const widths = [
    ...new Set(
      [...(options.widths || widthsForImages), info.width].map((width) =>
        Math.min(width, info.width),
      ),
    ),
  ].sort((a, b) => a - b)
  const variants = []
  for (const width of widths) {
    const resized = sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    }).resize({ width, withoutEnlargement: true })
    const [webp, avif] = await Promise.all([
      resized
        .clone()
        .webp({ quality: 83, alphaQuality: 100, effort: 5 })
        .toBuffer({ resolveWithObject: true }),
      resized
        .clone()
        .avif({
          quality: metadata.hasAlpha ? 60 : 55,
          effort: 4,
          chromaSubsampling: metadata.hasAlpha ? '4:4:4' : '4:2:0',
        })
        .toBuffer(),
    ])
    variants.push({ width, height: webp.info.height, webp: webp.data, avif })
  }
  return { width: info.width, height: info.height, variants }
}
module.exports = { createImageVariants }
