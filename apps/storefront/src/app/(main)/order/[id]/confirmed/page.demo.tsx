import { Suspense } from "react"
import type { Metadata } from "next"
import { DemoOrder, DemoOrderLoading } from "@modules/nord/demo-order"

export const dynamicParams = false
export const metadata: Metadata = { title: "Подтверждение заказа", robots: { index: false, follow: false } }

export function generateStaticParams() {
  return [{ id: "demo" }]
}

export default function DemoOrderPage() {
  return <Suspense fallback={<DemoOrderLoading />}><DemoOrder /></Suspense>
}
