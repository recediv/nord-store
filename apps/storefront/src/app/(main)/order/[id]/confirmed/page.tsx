import { retrieveOrder } from "@lib/data/orders"
import { OrderConfirmation } from "@modules/nord/order"
import { OrderUnavailable } from "@modules/nord/order-acknowledge"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}
export const metadata: Metadata = {
  title: "Заказ оформлен",
  description: "Подтверждение демонстрационного заказа NORD.",
  robots: { index: false, follow: false },
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  if (!/^order_[a-zA-Z0-9_-]+$/.test(params.id)) return notFound()
  const order = await retrieveOrder(params.id).catch(() => null)

  // The official error adapter does not preserve HTTP status. A failed read
  // must not claim that a successfully completed order does not exist.
  if (!order || order.id !== params.id) return <OrderUnavailable />

  return <OrderConfirmation order={order} />
}
