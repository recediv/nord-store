import type { Metadata } from "next"
import { Checkout } from "@modules/nord/checkout"

export const metadata: Metadata = {
  title: { absolute: "Оформление заказа — NORD" },
  robots: { index: false, follow: true },
}

export default function CheckoutPage() {
  // Options belong to the provider's restored cart and address. The shared UI
  // loads them through that provider and handles empty/recovering carts itself.
  return <Checkout />
}
