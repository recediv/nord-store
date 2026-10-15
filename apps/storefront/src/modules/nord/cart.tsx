"use client"

import { useState, type FormEvent, type MouseEvent } from "react"
import type { HttpTypes } from "@medusajs/types"
import {
  ArrowRight,
  Check,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react"
import { money } from "@lib/nord/format"
import { Link } from "./link"
import { StoreImage } from "./image"
import { useNord } from "./provider"
import "./styles/cart-ui.css"
import "./styles/cart.css"

export function cartLineInfo(item: HttpTypes.StoreCartLineItem, demo = false) {
  const variant = item.variant
  const stock =
    variant?.manage_inventory &&
    !variant.allow_backorder &&
    typeof variant.inventory_quantity === "number"
      ? Math.max(0, variant.inventory_quantity)
      : demo && typeof item.metadata?.stock === "number"
        ? Math.min(10, Math.max(0, item.metadata.stock))
        : null
  const variantName = item.variant_title || variant?.title || ""
  return {
    name:
      item.product_title ||
      item.product?.title ||
      item.title ||
      "Товар недоступен",
    handle: item.product_handle || item.product?.handle || "",
    image: item.thumbnail || item.product?.thumbnail || "",
    color: /^default variant$/i.test(variantName) ? "" : variantName,
    unavailable:
      !item.variant_id ||
      item.variant === null ||
      item.product === null ||
      stock === 0,
    stock,
    total: item.total ?? item.item_total ?? item.unit_price * item.quantity,
  }
}

export function CartSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Загружаем товары корзины…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="cart-line cart-placeholder"
          key={index}
          aria-hidden="true"
        >
          <div className="cart-line-image skeleton" />
          <div className="cart-line-info">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-text" />
            <span className="skeleton skeleton-price" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CartLine({ item }: { item: HttpTypes.StoreCartLineItem }) {
  const { update, pending, recovery, setDrawer, mode } = useNord()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const line = cartLineInfo(item, mode === "demo")
  const disabled = pending || busy || recovery
  const canOpen = !!line.handle && item.product !== null

  function closeOnNavigate(event: MouseEvent<HTMLAnchorElement>) {
    if (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      (!event.currentTarget.target || event.currentTarget.target === "_self")
    )
      setDrawer(false)
  }

  async function changeQuantity(quantity: number) {
    if (disabled) return
    setBusy(true)
    setError("")
    try {
      await update(item.id, quantity)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось изменить корзину. Попробуйте ещё раз.",
      )
    } finally {
      setBusy(false)
    }
  }

  const photo = line.image ? (
    <StoreImage image={line.image} preset="thumbnail" alt="" loading="lazy" />
  ) : (
    <ShoppingBag size={28} aria-hidden="true" />
  )
  const imageClass = `cart-line-image${line.image ? "" : " cart-image-placeholder"}`
  return (
    <div className="cart-line" aria-busy={busy}>
      {canOpen ? (
        <Link
          href={`/product/${line.handle}`}
          className={imageClass}
          aria-label={line.name}
          onClick={closeOnNavigate}
        >
          {photo}
        </Link>
      ) : (
        <div className={imageClass} aria-hidden="true">
          {photo}
        </div>
      )}
      <div className="cart-line-info">
        {canOpen ? (
          <Link href={`/product/${line.handle}`} onClick={closeOnNavigate}>
            {line.name}
          </Link>
        ) : (
          <strong>{line.name}</strong>
        )}
        {line.color && <span className="muted small-text">{line.color}</span>}
        <strong>{money(line.total)}</strong>
        {line.unavailable ? (
          <span className="small-text form-error">
            Товар больше недоступен. Удалите его из корзины.
          </span>
        ) : line.stock !== null && item.quantity > line.stock ? (
          <span className="small-text form-error">
            Можно заказать: {line.stock} шт. Уменьшите количество.
          </span>
        ) : null}
        <div className="cart-line-controls">
          <div className="quantity-control">
            <button
              type="button"
              aria-label={`Уменьшить количество: ${line.name}`}
              disabled={disabled}
              onClick={() => void changeQuantity(item.quantity - 1)}
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <output aria-label={`Количество: ${line.name}`} aria-live="polite">
              {item.quantity}
            </output>
            <button
              type="button"
              aria-label={`Увеличить количество: ${line.name}`}
              disabled={
                disabled ||
                line.unavailable ||
                (line.stock !== null && item.quantity >= line.stock)
              }
              onClick={() => void changeQuantity(item.quantity + 1)}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="icon-button remove-item"
            aria-label={`Удалить из корзины: ${line.name}`}
            disabled={disabled}
            onClick={() => void changeQuantity(0)}
          >
            {busy ? (
              <LoaderCircle
                size={16}
                className="nord-cart-spinner"
                aria-hidden="true"
              />
            ) : (
              <Trash2 size={16} aria-hidden="true" />
            )}
          </button>
        </div>
        {error && (
          <span className="small-text form-error" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}

export function PromoCode() {
  const { cart, applyPromo, pending, recovery, mode, config } = useNord()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const applied = (cart?.promotions || [])
    .filter((promotion) => !promotion.is_automatic && promotion.code)
    .map((promotion) => promotion.code!)
  const disabled = pending || busy || recovery || !cart

  async function submit(value: string) {
    if (disabled) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await applyPromo(value.trim())
      setMessage(
        value.trim()
          ? "Промокод применён. Итог заказа обновлён."
          : "Промокод удалён.",
      )
      setCode("")
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось применить промокод. Попробуйте ещё раз.",
      )
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (code.trim()) void submit(code)
  }

  return (
    <div className="promo-block">
      {applied.length > 0 ? (
        <div className="applied-promo">
          <span>
            <Check size={15} aria-hidden="true" />
            {applied.join(", ")} · применён
          </span>
          <button
            type="button"
            disabled={disabled}
            aria-label="Убрать промокод"
            onClick={() => void submit("")}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <form className="promo-form" onSubmit={onSubmit} aria-busy={busy}>
          <input
            type="text"
            aria-label="Промокод"
            value={code}
            maxLength={100}
            disabled={disabled}
            onChange={(event) => {
              setCode(event.target.value)
              setError("")
              setMessage("")
            }}
            placeholder="Промокод"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={disabled || !code.trim()}
            aria-label="Применить промокод"
          >
            {busy ? (
              <LoaderCircle
                size={19}
                className="nord-cart-spinner"
                aria-hidden="true"
              />
            ) : (
              <ArrowRight size={20} aria-hidden="true" />
            )}
          </button>
        </form>
      )}
      {error ? (
        <small className="field-error" role="alert">
          {error}
        </small>
      ) : message ? (
        <small className="promo-message" role="status">
          {message}
        </small>
      ) : (
        !applied.length && (
          <small className="muted">
            {mode === "demo" && config.promotion
              ? `Ваш первый заказ: −${config.promotion.percentage}% с кодом ${config.promotion.code}`
              : "Введите промокод, чтобы проверить условия скидки"}
          </small>
        )
      )}
    </div>
  )
}

export function CartError() {
  const { cartError, refreshCart, pending, recovery } = useNord()
  if (!cartError) return null
  return (
    <p className="form-error" role="alert">
      {cartError}{" "}
      <button
        type="button"
        className="text-link"
        disabled={pending || recovery}
        onClick={() => void refreshCart().catch(() => {})}
      >
        Повторить загрузку
      </button>
    </p>
  )
}

function RecoveryNotice() {
  const { recovery, recovering } = useNord()
  return recovery ? (
    <p className="cart-recovery-notice" role="status">
      {recovering
        ? "Проверяем результат оформления…"
        : "Результат оформления уточняется. Проверьте статус заказа с помощью сообщения вверху страницы."}
    </p>
  ) : null
}

function CartTotals({ checkout = false }: { checkout?: boolean }) {
  const { cart } = useNord()
  const original = cart?.original_item_total ?? 0
  const items = cart?.item_total ?? 0
  const discount = Math.max(0, original - items)
  return (
    <>
      <div className="summary-row">
        <span>Товары</span>
        <span>{money(original)}</span>
      </div>
      {discount > 0 && (
        <div className="summary-row discount">
          <span>Скидка</span>
          <span>−{money(discount)}</span>
        </div>
      )}
      {checkout && (
        <div className="summary-row">
          <span>Доставка</span>
          <span>
            {cart?.shipping_total ? money(cart.shipping_total) : "Бесплатно"}
          </span>
        </div>
      )}
      <div className="summary-row grand-total">
        <strong>{checkout ? "Итого с доставкой" : "Итого за товары"}</strong>
        <strong>{money(checkout ? (cart?.total ?? 0) : items)}</strong>
      </div>
    </>
  )
}

function CheckoutLink({ children = "Оформить заказ" }: { children?: string }) {
  const { cart, pending, cartError, recovery, setDrawer, mode } = useNord()
  const unavailable = (cart?.items || []).some((item) => {
    const line = cartLineInfo(item, mode === "demo")
    return (
      line.unavailable || (line.stock !== null && item.quantity > line.stock)
    )
  })
  const disabled =
    pending || !!cartError || recovery || unavailable || !cart?.items?.length
  return (
    <>
      {unavailable && (
        <p className="form-error small-text" role="status">
          Проверьте недоступные товары и количество в корзине.
        </p>
      )}
      <Link
        className="button full"
        href="/checkout"
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) event.preventDefault()
          else setDrawer(false)
        }}
      >
        {children}
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </>
  )
}

export function CartContents({ drawer = false }: { drawer?: boolean }) {
  const {
    cart,
    pending,
    storageReady,
    cartError,
    recovery,
    config,
    setDrawer,
  } = useNord()
  const items = cart?.items || []
  const threshold = config.freeShippingFrom
  if (!cart && !cartError && !recovery && (pending || !storageReady))
    return <CartSkeleton />
  if (recovery && !cart) return <RecoveryNotice />
  if (cartError && !items.length)
    return (
      <div className="empty-state">
        <h3>Не удалось загрузить корзину</h3>
        <CartError />
      </div>
    )
  if (!items.length)
    return (
      <div className="empty-state">
        <ShoppingBag size={43} strokeWidth={1} aria-hidden="true" />
        <h3>Здесь начинается уют</h3>
        <p>Добавьте вещи, которые сделают ваш дом любимым местом.</p>
        <Link
          href="/catalog"
          className="button"
          onClick={() => setDrawer(false)}
        >
          Перейти в каталог <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    )
  return (
    <>
      <RecoveryNotice />
      <CartError />
      {!!threshold && (
        <div className="shipping-progress">
          <Truck size={19} aria-hidden="true" />
          <span>
            {(cart?.item_total ?? 0) >= threshold
              ? "Достигнут порог бесплатной стандартной доставки"
              : `Ещё ${money(threshold - (cart?.item_total ?? 0))} до порога бесплатной стандартной доставки`}
          </span>
          <div
            role="progressbar"
            aria-label="До порога бесплатной доставки"
            aria-valuemin={0}
            aria-valuemax={threshold}
            aria-valuenow={Math.min(
              threshold,
              Math.max(0, cart?.item_total ?? 0),
            )}
          >
            <span
              style={{
                width: `${Math.min(100, Math.max(0, ((cart?.item_total ?? 0) / threshold) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
      <div className="drawer-items">
        {items.map((item) => (
          <CartLine key={item.id} item={item} />
        ))}
      </div>
      <div className="drawer-bottom">
        <PromoCode />
        <CartTotals />
        <CheckoutLink />
        {drawer && (
          <Link
            className="drawer-cart-link"
            href="/cart"
            onClick={() => setDrawer(false)}
          >
            Открыть корзину
          </Link>
        )}
        <p className="muted small-text centered">
          Стоимость и доступность доставки уточняются при оформлении
        </p>
      </div>
    </>
  )
}

export function CartPage() {
  const { cart, pending, storageReady, cartError, recovery, config } = useNord()
  const items = cart?.items || []
  const loading = !cart && !cartError && !recovery && (pending || !storageReady)
  return (
    <main className="container cart-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <ol>
          <li>
            <Link href="/">Главная</Link>
          </li>
          <li aria-current="page">Корзина</li>
        </ol>
      </nav>
      <div className="page-title">
        <span className="eyebrow">УЮТ БЛИЖЕ, ЧЕМ КАЖЕТСЯ</span>
        <h1>
          Ваша корзина
          <sup>{items.reduce((sum, item) => sum + item.quantity, 0)}</sup>
        </h1>
      </div>
      <RecoveryNotice />
      <CartError />
      {!items.length && !loading && !cartError && !recovery ? (
        <div className="empty-state">
          <ShoppingBag size={48} strokeWidth={1} aria-hidden="true" />
          <h2>Пока здесь пусто</h2>
          <p>Самое время найти вещи, с которыми дома станет ещё лучше.</p>
          <Link className="button" href="/catalog">
            Найти своё <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      ) : loading ? (
        <CartSkeleton />
      ) : items.length > 0 ? (
        <div className="cart-layout">
          <div className="cart-page-items">
            {items.map((item) => (
              <CartLine key={item.id} item={item} />
            ))}
            <Link className="text-link" href="/catalog">
              Продолжить выбирать <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <aside className="order-summary" aria-labelledby="cart-summary-title">
            <h2 id="cart-summary-title">Ваш заказ</h2>
            <PromoCode />
            <CartTotals />
            <CheckoutLink>К оформлению</CheckoutLink>
            <p className="small-text muted summary-note">
              <Truck size={16} aria-hidden="true" />
              <span>
                Доставка рассчитывается на следующем шаге.
                {config.freeShippingFrom
                  ? ` По доступным стандартным тарифам — бесплатно от ${money(config.freeShippingFrom)} после скидки.`
                  : ""}
              </span>
            </p>
          </aside>
        </div>
      ) : null}
    </main>
  )
}

export default CartPage
