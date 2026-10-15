import type { Metadata } from "next"
import { NotFound } from "@modules/nord/info"

export const metadata: Metadata = {
  title: "Страница не найдена",
  description: "Этой страницы нет. Найдите любимые вещи в каталоге NORD.",
  robots: { index: false, follow: true },
}

export default NotFound
