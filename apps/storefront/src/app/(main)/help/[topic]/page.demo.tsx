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
export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(titles).map((topic) => ({ topic }))
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params
  return { title: titles[topic] || "Помощь" }
}

export default async function DemoHelpPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params
  if (!Object.hasOwn(titles, topic)) notFound()
  return <Help topic={topic} />
}
