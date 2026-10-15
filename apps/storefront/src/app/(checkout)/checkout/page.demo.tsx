import type { Metadata } from "next"
import { Checkout } from "@modules/nord/checkout"

export const metadata: Metadata = { title: "Оформление заказа", robots: { index: false, follow: false } }

export default Checkout
