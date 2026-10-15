import type { Metadata } from "next"
import { Inspiration } from "@modules/nord/info"

export const metadata: Metadata = {
  title: { absolute: "Вдохновение — NORD" },
  description: "Идеи для гостиной, спальни, кухни и рабочего пространства.",
}

export default function InspirationPage() {
  return <Inspiration />
}
