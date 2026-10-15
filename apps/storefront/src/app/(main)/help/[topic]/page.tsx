import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Help } from "@modules/nord/info"

const titles: Record<string, string> = {
  delivery: "Доставка и оплата",
  returns: "Обмен и возврат",
  care: "Уход за вещами",
  contacts: "Контакты",
  privacy: "Конфиденциальность",
}
type Props = { params: Promise<{ topic: string }> }

export function generateStaticParams() {
  return Object.keys(titles).map((topic) => ({ topic }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params
  if (!Object.hasOwn(titles, topic)) notFound()
  return { title: { absolute: `${titles[topic]} — NORD` } }
}

export default async function HelpPage({ params }: Props) {
  const { topic } = await params
  if (!Object.hasOwn(titles, topic)) notFound()
  return <Help topic={topic} />
}
