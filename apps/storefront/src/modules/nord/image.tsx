import type { ImgHTMLAttributes } from "react"
import { preload } from "react-dom"
import { assetPath } from "@lib/nord/asset-path"
import designManifest from "./image-design-manifest.json"
import demoManifest from "./image-demo-manifest.json"
import uploadWidths from "../../../../../packages/images/widths.json"

export type ImagePreset =
  | "card"
  | "thumbnail"
  | "menu"
  | "detail"
  | "zoom"
  | "showcase"
  | "editorial"
  | "banner"

type ImageInfo = {
  width: number
  height: number
  version?: string
  variants: { width: number; src: string }[]
  avif?: { width: number; src: string }[]
}

const localImages: Record<string, ImageInfo> =
  process.env.NEXT_PUBLIC_COMMERCE_MODE === "demo"
    ? demoManifest
    : designManifest
function imageSizes(preset: ImagePreset, ratio: number) {
  switch (preset) {
    case "thumbnail":
      return `${Math.ceil(Math.max(76, 76 * ratio))}px`
    case "menu":
      return `${Math.ceil(Math.max(290, 180 * ratio))}px`
    case "card": {
      const factor = Math.max(1, ratio * 1.06)
      return `(max-width: 600px) calc((100vw - 52px) / 2 * ${factor.toFixed(3)}), (max-width: 850px) calc((100vw - 74px) / 2 * ${factor.toFixed(3)}), (max-width: 1150px) calc((100vw - 350px) / 2 * ${factor.toFixed(3)}), ${Math.ceil(360 * factor)}px`
    }
    case "detail":
      return `(max-width: 600px) max(calc(100vw - 40px), ${Math.ceil(405 * ratio)}px), (max-width: 850px) max(calc((100vw - 68px) / 2), ${Math.ceil(550 * ratio)}px), ${Math.ceil(Math.max(700, 620 * ratio))}px`
    case "zoom":
      return `(max-width: 600px) calc(100vw - 40px), min(1000px, ${Math.ceil(70 * ratio)}vh)`
    case "showcase":
      return "(max-width: 600px) 160px, (max-width: 850px) 300px, 480px"
    case "editorial":
      return "(max-width: 850px) calc(100vw - 40px), (max-width: 1480px) calc((100vw - 90px) / 2), 700px"
    case "banner":
      return "(max-width: 600px) max(calc(100vw - 40px), 380px), (max-width: 1480px) calc(100vw - 64px), 1416px"
  }
}

function uploadedImage(image: string): ImageInfo | undefined {
  const match = image.match(/^(.*-nord-(\d+)x(\d+))\.webp$/)
  if (!match) return undefined
  const width = Number(match[2])
  const height = Number(match[3])
  if (!width || !height) return undefined
  const stem = match[1].replace("/static/", "/media/")
  const widths = Array.from(
    new Set(uploadWidths.concat(width).map((size) => Math.min(size, width))),
  ).sort((a, b) => a - b)
  const source = (size: number, format: string) =>
    `${stem}${size === width ? "" : `-${size}`}.${format}`
  return {
    width,
    height,
    variants: widths.map((width) => ({ width, src: source(width, "webp") })),
    avif: widths.map((width) => ({ width, src: source(width, "avif") })),
  }
}

export type StoreImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet"
> & { image: string; preset?: ImagePreset; alt: string }

/** Local artwork uses the design manifest; product URLs keep their backend origin. */
export function StoreImage({
  image,
  preset = "card",
  sizes: requestedSizes,
  width,
  height,
  alt,
  ...props
}: StoreImageProps) {
  const design = localImages[image]
  const info = design || uploadedImage(image)
  const sizes =
    requestedSizes ??
    (info ? imageSizes(preset, info.width / info.height) : undefined)
  const sourceUrl = (url: string) => {
    const source = info?.version ? `${url}?v=${info.version}` : url
    return design ? assetPath(source) : source
  }
  const fallback = /^(?:https?:\/\/|\/|data:|blob:)/.test(image)
    ? image
    : assetPath(`/images/${image}`)
  const src = info
    ? sourceUrl(info.variants[info.variants.length - 1].src)
    : fallback
  const srcSet = info?.variants
    .map((variant) => `${sourceUrl(variant.src)} ${variant.width}w`)
    .join(", ")
  const avifSet = info?.avif
    ?.map((variant) => `${sourceUrl(variant.src)} ${variant.width}w`)
    .join(", ")

  if (props.fetchPriority === "high") {
    const avif = info?.avif
    preload(avif?.length ? sourceUrl(avif[avif.length - 1].src) : src, {
      as: "image",
      ...(avifSet ? { type: "image/avif" } : {}),
      imageSrcSet: avifSet || srcSet,
      imageSizes: sizes,
      fetchPriority: "high",
      crossOrigin: props.crossOrigin,
    })
  }

  const element = (
    // Responsive AVIF/WebP variants are already generated for both data sources.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={width ?? info?.width}
      height={height ?? info?.height}
      decoding="async"
      {...props}
    />
  )
  return avifSet ? (
    <picture className="store-picture">
      <source type="image/avif" srcSet={avifSet} sizes={sizes} />
      {element}
    </picture>
  ) : (
    element
  )
}
