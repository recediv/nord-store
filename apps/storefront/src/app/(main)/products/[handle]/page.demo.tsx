import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { demoProducts, demoCatalog } from "@lib/nord/demo-data"
import { decodeHandleParameter } from "@lib/nord/handles"
import { ProductPage } from "@modules/nord/product"

export const dynamicParams = false

export function generateStaticParams() {
  return demoProducts.map((product) => ({ handle: product.handle }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle: parameter } = await params
  const handle = decodeHandleParameter(parameter)
  if (!handle) notFound()
  const product = demoProducts.find((product) => product.handle === handle)
  return product
    ? {
        title: product.name,
        description: product.description,
        alternates: { canonical: `/products/${encodeURIComponent(handle)}` },
      }
    : { title: "Товар не найден" }
}

export default async function DemoProductPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle: parameter } = await params
  const handle = decodeHandleParameter(parameter)
  if (!handle) notFound()
  const product = demoProducts.find((product) => product.handle === handle)
  if (!product) notFound()
  const related = demoCatalog(
    new URLSearchParams({
      similarTo: handle,
      exclude: handle,
      inStock: "true",
      limit: "4",
    }),
  ).products
  return <ProductPage product={product} related={related} />
}
