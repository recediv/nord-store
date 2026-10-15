import type { HttpTypes } from "@medusajs/types"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { money } from "@lib/nord/format"
import { Link } from "./link"
import { AcknowledgeNordOrder } from "./order-acknowledge"
import "./styles/checkout.css"

export function OrderConfirmation({ order }: { order: HttpTypes.StoreOrder }) {
  const date = new Date(order.created_at)
  const orderNumber = order.custom_display_id || order.display_id || order.id
  const discount = Math.max(0, order.original_item_total - order.item_total)
  const address = order.shipping_address
  const deliveryAddress = address
    ? [address.postal_code, address.city, address.address_1, address.address_2]
        .filter(Boolean)
        .join(", ")
    : ""
  const name = address
    ? [address.first_name, address.last_name].filter(Boolean).join(" ")
    : ""
  return (
    <main className="container confirmation-page">
      <div className="confirmation-icon">
        <CheckCircle2 size={56} strokeWidth={1.3} aria-hidden="true" />
      </div>
      <span className="eyebrow">ВАШ УЮТ УЖЕ В ПУТИ — В ДЕМО-РЕЖИМЕ</span>
      <h1>Спасибо за ваш выбор.</h1>
      <p>
        Демо-заказ <strong>№ {orderNumber}</strong> успешно оформлен.
      </p>
      <div className="confirmation-card">
        <div className="summary-row">
          <span>Номер заказа</span>
          <strong>{orderNumber}</strong>
        </div>
        {!Number.isNaN(date.getTime()) && (
          <div className="summary-row">
            <span>Дата</span>
            <time dateTime={date.toISOString()}>
              {date.toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </div>
        )}
        {(order.items || []).map((item) => {
          const variant = item.variant_title || item.variant?.title || ""
          const color = /^default variant$/i.test(variant) ? "" : variant
          return (
            <div className="confirmation-item" key={item.id}>
              <span>
                {item.product_title || item.title}
                <small>
                  {color ? `${color} · ` : ""}
                  {item.quantity} шт.
                </small>
              </span>
              <b>{money(item.total ?? item.unit_price * item.quantity)}</b>
            </div>
          )
        })}
        <div className="summary-row">
          <span>Товары</span>
          <span>{money(order.original_item_total)}</span>
        </div>
        {discount > 0 && (
          <div className="summary-row discount">
            <span>Скидка</span>
            <span>−{money(discount)}</span>
          </div>
        )}
        <div className="summary-row">
          <span>Доставка</span>
          <span>
            {order.shipping_total ? money(order.shipping_total) : "Бесплатно"}
          </span>
        </div>
        <div className="summary-row grand-total">
          <strong>Итого с доставкой</strong>
          <strong>{money(order.total)}</strong>
        </div>
        {(deliveryAddress || order.shipping_methods?.length) && (
          <section
            className="confirmation-delivery"
            aria-labelledby="confirmation-delivery-title"
          >
            <h2 id="confirmation-delivery-title">Доставка</h2>
            {!!order.shipping_methods?.length && (
              <p>
                {order.shipping_methods.map((method) => method.name).join(", ")}
              </p>
            )}
            {name && <p>{name}</p>}
            {deliveryAddress && <address>{deliveryAddress}</address>}
          </section>
        )}
      </div>
      <AcknowledgeNordOrder orderId={order.id} />
      <p className="confirmation-note">
        Демо-заказ сохранён. Деньги не списываются, реальная доставка не
        выполняется.
      </p>
      <Link className="button" href="/catalog">
        Продолжить выбирать <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </main>
  )
}

export default OrderConfirmation
