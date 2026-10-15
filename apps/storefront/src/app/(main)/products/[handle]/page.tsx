import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { catalogData } from "@lib/nord/data"
import { decodeHandleParameter } from "@lib/nord/handles"
import { ProductPage } from "@modules/nord/product"

type Props = { params: Promise<{ handle: string }> }
const productData = cache(async (handle: string) => {
  const catalog = await catalogData(
    new URLSearchParams({ handles: handle, limit: "1" }),
  )
  return catalog.products.find((product) => product.handle === handle)
})

export async function generateStaticParams() {
  const params: { handle: string }[] = []
  let offset = 0
  while (true) {
    const page = await catalogData(
      new URLSearchParams({ limit: "24", offset: String(offset) }),
    )
    for (const product of page.products) params.push({ handle: product.handle })
    offset += page.products.length
    if (!page.products.length || offset >= page.count) break
  }
  return params
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle: parameter } = await params
  const handle = decodeHandleParameter(parameter)
  if (!handle) notFound()
  const product = await productData(handle)
  if (!product) notFound()
  return {
    title: { absolute: `${product.name} — NORD` },
    description: product.description,
    alternates: {
      canonical: `/products/${encodeURIComponent(handle)}`,
    },
    openGraph: {
      title: `${product.name} — NORD`,
      description: product.description,
      images: product.image ? [product.image] : [],
    },
  }
}

export default async function NativeProductPage({ params }: Props) {
  const { handle: parameter } = await params
  const handle = decodeHandleParameter(parameter)
  if (!handle) notFound()
  const product = await productData(handle)
  if (!product) notFound()
  const related = await catalogData(
    new URLSearchParams({
      similarTo: handle,
      exclude: handle,
      inStock: "true",
      limit: "4",
    }),
  )
  return <ProductPage product={product} related={related.products} />
}
