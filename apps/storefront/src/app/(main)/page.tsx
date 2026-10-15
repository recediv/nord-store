import type { Metadata } from "next"
import { homeData } from "@lib/nord/data"
import { Home } from "@modules/nord/home"

export const metadata: Metadata = {
  title: { absolute: "NORD — Вещи для жизни" },
  description:
    "Мебель, свет, декор и текстиль с характером. Соберите пространство, в котором легко быть собой.",
  alternates: { canonical: "/" },
}

export default async function HomePage() {
  return <Home home={await homeData()} />
}
