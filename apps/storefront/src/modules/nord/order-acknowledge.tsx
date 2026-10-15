"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, RotateCcw } from "lucide-react"
import { Link } from "./link"
import { useNord } from "./provider"

/** Mounted only after the server has retrieved this order successfully. */
export function AcknowledgeNordOrder({ orderId }: { orderId: string }) {
  const { acknowledgeOrder } = useNord()
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let current = true
    setPending(true)
    setError(false)
    void acknowledgeOrder(orderId)
      .then(() => {
        if (current) setPending(false)
      })
      .catch(() => {
        if (current) {
          setPending(false)
          setError(true)
        }
      })
    return () => {
      current = false
    }
  }, [orderId, acknowledgeOrder, attempt])

  if (!error) return null
  return (
    <p className="confirmation-note form-error" role="status">
      Заказ подтверждён. Не удалось обновить состояние корзины.{" "}
      <button
        type="button"
        className="text-link"
        disabled={pending}
        onClick={() => setAttempt((value) => value + 1)}
      >
        Повторить
      </button>
    </p>
  )
}

export function OrderUnavailable() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <main className="container confirmation-page">
      <span className="eyebrow">ПОДТВЕРЖДЕНИЕ ЗАКАЗА</span>
      <h1>Не удалось загрузить подтверждение</h1>
      <p>
        Заказ мог быть уже создан. Обновите страницу или проверьте его статус в
        сообщении магазина.
      </p>
      <div className="confirmation-actions">
        <button
          type="button"
          className="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          {pending ? "Загружаем…" : "Обновить подтверждение"}
          <RotateCcw size={17} aria-hidden="true" />
        </button>
        <Link className="text-link" href="/cart">
          Перейти в корзину <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </main>
  )
}
