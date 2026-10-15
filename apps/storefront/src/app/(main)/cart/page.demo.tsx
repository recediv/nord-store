import type { Metadata } from "next"
import { CartPage } from "@modules/nord/cart"

export const metadata: Metadata = { title: "Корзина", robots: { index: false, follow: false } }

export default CartPage
