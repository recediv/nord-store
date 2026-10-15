import { cache } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getCategoryByHandle } from "@lib/data/categories"
import { storefrontData } from "@lib/nord/data"
import { decodeHandleParameter } from "@lib/nord/handles"

type Props = {
  params: Promise<{ category: string[] }>
}

const resolveCategory = cache(async (handle: string) => {
  const segments = handle.split("/").map((parameter) => {
    const segment = decodeHandleParameter(parameter)
    if (!segment) notFound()
    return segment
  })
  const [category, config] = await Promise.all([
    getCategoryByHandle(segments),
    storefrontData(),
  ])
  if (
    !category ||
    !config.categories.some((entry) => entry.id === category.handle)
  )
    notFound()
  return category
})

function catalogPath(handle: string) {
  return `/store?${new URLSearchParams({ category: handle })}`
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const category = await resolveCategory(params.category.join("/"))
  return {
    title: category.name,
    description:
      category.description ||
      `${category.name} — предметы для вашего дома в NORD.`,
    alternates: { canonical: catalogPath(category.handle) },
  }
}

export default async function CategoryPage(props: Props) {
  const params = await props.params
  const category = await resolveCategory(params.category.join("/"))
  redirect(catalogPath(category.handle))
}
