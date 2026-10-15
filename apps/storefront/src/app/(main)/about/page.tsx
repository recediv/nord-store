import type { Metadata } from "next"
import { About } from "@modules/nord/info"

export const metadata: Metadata = {
  title: { absolute: "О NORD — Вещи для жизни" },
  description: "Наша история и вещи, которые делают дом уютнее.",
}

export default function AboutPage() {
  return <About />
}
