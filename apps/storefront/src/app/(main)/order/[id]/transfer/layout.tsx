import type { ReactNode } from "react"
import type { Metadata } from "next"
import "../../../../../styles/globals.css"

export const metadata: Metadata = {
  title: "Передача заказа",
  robots: { index: false, follow: false },
}

export default function TransferLayout({ children }: { children: ReactNode }) {
  return children
}
