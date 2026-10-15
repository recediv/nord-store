import type { Metadata } from "next"
import { catalogData, storefrontData } from "@lib/nord/data"
import { Catalog } from "@modules/nord/catalog"
import { catalogMetadata, catalogQuery } from "@lib/nord/catalog-meta"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const [values, config] = await Promise.all([searchParams, storefrontData()])
  const query = catalogQuery(values)
  const { title, canonical } = catalogMetadata(query, config.categories)
  return {
    // Catalog renders these three tags through React 19, keeping a single
    // owner when filters update the native History API without an RSC request.
    title: null,
    description:
      "Мебель, освещение, декор и текстиль. Подберите вещи по цене, материалу, цвету и комнате.",
    robots: null,
    alternates: { canonical: null },
    openGraph: { title: `${title} — NORD`, url: canonical },
  }
}

export default async function StorePage({ searchParams }: Props) {
  const query = catalogQuery(await searchParams)
  const initial = await catalogData(query)
  return <Catalog initial={initial} query={query.toString()} />
}
