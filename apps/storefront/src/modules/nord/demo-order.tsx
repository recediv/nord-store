"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Package } from "lucide-react"
import { money } from "@lib/nord/format"
import { Link } from "@modules/nord/link"
import { AcknowledgeNordOrder } from "./order-acknowledge"
import "./styles/checkout.css"

type Receipt = {
  id: string
  date: string
  total: number
  delivery: string
  items: { name: string; color: string; quantity: number; price: number }[]
}

function readReceipt(id: string): Receipt | null {
  if (!id) return null
  try {
    const value = JSON.parse(
      localStorage.getItem(`nord.receipt.${id}`) || "null",
    ) as Receipt | null
    if (
      !value ||
      value.id !== id ||
      !Number.isFinite(value.total) ||
      typeof value.date !== "string" ||
      Number.isNaN(new Date(value.date).getTime()) ||
      !Array.isArray(value.items) ||
      !value.items.length ||
      !value.items.every(
        (item) =>
          item &&
          typeof item.name === "string" &&
          typeof item.color === "string" &&
          Number.isFinite(item.price) &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0,
      )
    )
      return null
    return value
  } catch {
    return null
  }
}

export function DemoOrderLoading() {
  return (
    <main className="container confirmation-page">
      <h1>Подтверждение заказа</h1>
      <div className="confirmation-card" role="status">
        Загружаем подтверждение…
      </div>
    </main>
  )
}

export function DemoOrder() {
  const id = useSearchParams().get("id") || ""
  const [confirmation, setConfirmation] = useState<{
    id: string
    receipt: Receipt | null
  } | null>(null)
  useEffect(() => setConfirmation({ id, receipt: readReceipt(id) }), [id])
  if (!confirmation || confirmation.id !== id) return <DemoOrderLoading />
  const receipt = confirmation.receipt
  if (!receipt)
    return (
      <main className="container empty-state page-empty">
        <Package size={44} />
        <h1>Заказ не найден в этом браузере</h1>
        <p>
          Подтверждения демо-заказов сохраняются на устройстве, где их оформили.
        </p>
        <Link className="button" href="/catalog">
          Вернуться в магазин
        </Link>
      </main>
    )

  return (
    <main className="container confirmation-page">
      <div className="confirmation-icon">
        <CheckCircle2 size={56} strokeWidth={1.3} />
      </div>
      <AcknowledgeNordOrder orderId={receipt.id} />
      <span className="eyebrow">ВАШ УЮТ УЖЕ В ПУТИ — В ДЕМО-РЕЖИМЕ</span>
      <h1>Спасибо за ваш выбор.</h1>
      <p>
        Демо-заказ <strong>{receipt.id}</strong> успешно оформлен.
      </p>
      <div className="confirmation-card">
        <div className="summary-row">
          <span>Номер заказа</span>
          <strong>{receipt.id}</strong>
        </div>
        <div className="summary-row">
          <span>Дата</span>
          <span>{new Date(receipt.date).toLocaleDateString("ru-RU")}</span>
        </div>
        {receipt.items.map((item, index) => (
          <div className="confirmation-item" key={index}>
            <span>
              {item.name}
              <small>
                {item.color} · {item.quantity} шт.
              </small>
            </span>
            <b>{money(item.price * item.quantity)}</b>
          </div>
        ))}
        <div className="summary-row grand-total">
          <strong>Итого с доставкой</strong>
          <strong>{money(receipt.total)}</strong>
        </div>
      </div>
      <p className="muted">
        Заказ сохранён только в этом браузере. Деньги не списываются, реальная
        доставка не выполняется.
      </p>
      <Link className="button" href="/catalog">
        Продолжить выбирать
      </Link>
    </main>
  )
}
