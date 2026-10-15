import type { Metadata } from "next"
import { CartPage } from "@modules/nord/cart"

export const metadata: Metadata = {
  title: { absolute: "Корзина — NORD" },
  description: "Ваши выбранные вещи и итоговая стоимость заказа.",
  robots: { index: false, follow: true },
}

export default function Cart() {
  return <CartPage />
}
