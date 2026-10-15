import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

type Props = {
  params: Promise<{ handle: string }>
}

const titles: Record<string, string> = {
  new: "Новинки",
  sale: "Предметы со скидкой",
  featured: "Выбор NORD",
}

function collectionPath(handle: string) {
  if (!Object.hasOwn(titles, handle)) notFound()
  return `/store?${new URLSearchParams({ collection: handle })}`
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const canonical = collectionPath(params.handle)
  return {
    title: titles[params.handle],
    description: `${titles[params.handle]} — вещи с характером для вашего дома.`,
    alternates: { canonical },
  }
}

export default async function CollectionPage(props: Props) {
  const params = await props.params
  redirect(collectionPath(params.handle))
}
