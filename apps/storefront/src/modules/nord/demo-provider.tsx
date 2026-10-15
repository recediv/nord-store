"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import type { HttpTypes } from "@medusajs/types"
import type {
  CheckoutDetails,
  CheckoutOptions,
  Product,
  StorefrontConfig,
} from "@lib/nord/types"
import { demoCatalog, demoConfig, demoProducts } from "@lib/nord/demo-data"
import { defaultColor, getPrice, getStock } from "@lib/nord/format"
import { NordContext } from "./provider"
import { usePreferences } from "./preferences"

type Line = { handle: string; color: string; quantity: number }
type Receipt = {
  id: string
  date: string
  total: number
  delivery: string
  items: { name: string; color: string; quantity: number; price: number }[]
}
const products = new Map(
  demoProducts.map((product) => [product.handle, product]),
)
const lineId = (line: Line) =>
  `demo-${line.handle}-${encodeURIComponent(line.color)}`
const pendingKey = "nord.demo-order-pending.v1"
const detailsKey = "nord.demo-checkout.v1"

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error(
      "Не удалось сохранить данные демо в браузере. Освободите место или разрешите локальное хранение данных.",
    )
  }
}
function sanitize(value: unknown): Line[] {
  if (!Array.isArray(value)) return []
  const result = new Map<string, Line>()
  for (const entry of value.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue
    const product = products.get(entry.handle)
    if (
      !product ||
      !product.colors.some((color) => color.name === entry.color) ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1
    )
      continue
    const stock = Math.min(10, getStock(product, entry.color))
    if (stock < 1) continue
    const id = lineId(entry)
    result.set(id, {
      handle: product.handle,
      color: entry.color,
      quantity: Math.min(
        stock,
        entry.quantity + (result.get(id)?.quantity || 0),
      ),
    })
  }
  return Array.from(result.values())
}
function totals(
  lines: Line[],
  code: string,
  delivery: string,
  config: StorefrontConfig,
) {
  const subtotal = lines.reduce(
    (sum, line) =>
      sum + getPrice(products.get(line.handle)!, line.color) * line.quantity,
    0,
  )
  const promotion = config.promotion
  const discount =
    promotion && code === promotion.code
      ? Math.round((subtotal * promotion.percentage) / 100)
      : 0
  const shipping =
    !lines.length ||
    delivery === "pickup" ||
    (delivery === "standard" &&
      config.freeShippingFrom &&
      subtotal - discount >= config.freeShippingFrom)
      ? 0
      : (config.checkout || demoConfig.checkout)?.shipping.find(
          (option) => option.code === delivery,
        )?.amount || 0
  return { subtotal, discount, shipping, total: subtotal - discount + shipping }
}
function options(
  lines: Line[],
  promo: string,
  config: StorefrontConfig,
): CheckoutOptions {
  const source = config.checkout || demoConfig.checkout!
  return {
    payment: source.payment,
    shipping: source.shipping.map((option) => ({
      ...option,
      amount: totals(lines, promo, option.code, config).shipping,
    })),
  }
}
function snapshot(
  lines: Line[],
  promo: string,
  details: CheckoutDetails | null,
  config: StorefrontConfig,
): HttpTypes.StoreCart | null {
  if (!lines.length) return null
  const amounts = totals(lines, promo, details?.delivery || "standard", config)
  const address = details
    ? {
        first_name: details.firstName,
        last_name: details.lastName,
        address_1: details.address,
        city: details.city,
        postal_code: details.postalCode,
        phone: details.phone,
        country_code: "ru",
      }
    : null
  const shipping = (config.checkout || demoConfig.checkout)?.shipping.find(
    (option) =>
      option.id === details?.shippingOptionId ||
      option.code === details?.delivery,
  )
  // A compact StoreCart projection keeps the shared presentation independent
  // of the data source. No SDK, server actions, or payment requests run here.
  return {
    id: "cart_norddemo",
    currency_code: "rub",
    region_id: config.regionId || "demo-region",
    completed_at: null,
    email: details?.email || "",
    shipping_address: address,
    billing_address: address,
    items: lines.map((line) => {
      const product = products.get(line.handle)!
      const price = getPrice(product, line.color)
      return {
        id: lineId(line),
        cart_id: "cart_norddemo",
        product_handle: product.handle,
        product_id: product.handle,
        product_title: product.name,
        title: product.name,
        variant_title: line.color,
        variant_id: product.variants?.find(
          (variant) => variant.color === line.color,
        )?.id,
        thumbnail: product.image,
        quantity: line.quantity,
        unit_price: price,
        subtotal: price * line.quantity,
        total: price * line.quantity,
        original_total: price * line.quantity,
        tax_total: 0,
        discount_total: 0,
        metadata: { stock: getStock(product, line.color) },
      }
    }),
    original_item_total: amounts.subtotal,
    item_total: amounts.subtotal - amounts.discount,
    item_subtotal: amounts.subtotal,
    item_tax_total: 0,
    item_discount_total: amounts.discount,
    discount_total: amounts.discount,
    original_total: amounts.subtotal + amounts.shipping,
    subtotal: amounts.subtotal + amounts.shipping,
    total: amounts.total,
    tax_total: 0,
    shipping_subtotal: amounts.shipping,
    shipping_total: amounts.shipping,
    shipping_tax_total: 0,
    shipping_methods: shipping
      ? [
          {
            id: shipping.id,
            shipping_option_id: shipping.id,
            name: shipping.name,
            amount: amounts.shipping,
          },
        ]
      : [],
    promotions: promo
      ? [
          {
            id: "demo-promotion",
            code: promo,
            application_method: {
              type: "percentage",
              value: config.promotion?.percentage,
            },
          },
        ]
      : [],
  } as unknown as HttpTypes.StoreCart
}

async function loadCatalog(params: URLSearchParams, signal?: AbortSignal) {
  signal?.throwIfAborted()
  return demoCatalog(params)
}

export function DemoProvider({
  config,
  children,
}: {
  config: StorefrontConfig
  children: ReactNode
}) {
  const preferences = usePreferences(config)
  const router = useRouter()
  const [lines, setLines] = useState<Line[]>([])
  const [promo, setPromo] = useState("")
  const [details, setDetails] = useState<CheckoutDetails | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [pending, setPending] = useState(false)
  const [cartError, setCartError] = useState("")
  const [drawer, setDrawer] = useState(false)
  const [toast, setToast] = useState("")
  const [recovery, setRecovery] = useState(false)
  const linesRef = useRef<Line[]>([])
  const promoRef = useRef("")
  const detailsRef = useRef<CheckoutDetails | null>(null)
  const completion = useRef("")
  const operations = useRef(0)
  useEffect(() => {
    const restored = sanitize(read<unknown>("nord.cart.v1", []))
    linesRef.current = restored
    setLines(restored)
    const savedPromo = read<unknown>("nord.promo.v1", "")
    const code =
      typeof savedPromo === "string" && savedPromo === config.promotion?.code
        ? savedPromo
        : ""
    promoRef.current = code
    setPromo(code)
    const savedDetails = read<CheckoutDetails | null>(detailsKey, null)
    if (
      savedDetails &&
      typeof savedDetails === "object" &&
      typeof savedDetails.delivery === "string" &&
      typeof savedDetails.email === "string"
    ) {
      detailsRef.current = savedDetails
      setDetails(savedDetails)
    }
    const savedCompletion = read<unknown>(pendingKey, "")
    if (
      typeof savedCompletion === "string" &&
      savedCompletion &&
      read(`nord.receipt.${savedCompletion}`, null)
    ) {
      completion.current = savedCompletion
      setRecovery(true)
    }
    setHydrated(true)
  }, [config.promotion?.code])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const run = useCallback(
    async <T,>(
      action: () => T | Promise<T>,
      completing = false,
    ): Promise<T> => {
      if (completion.current && !completing)
        throw new Error(
          "Сначала откройте подтверждение оформленного демо-заказа.",
        )
      operations.current++
      setPending(true)
      setCartError("")
      try {
        return await action()
      } catch (error) {
        setCartError(
          error instanceof Error
            ? error.message
            : "Не удалось обновить демо-корзину.",
        )
        throw error
      } finally {
        if (--operations.current === 0) setPending(false)
      }
    },
    [],
  )
  const replaceLines = useCallback((next: Line[]) => {
    save("nord.cart.v1", next)
    linesRef.current = next
    setLines(next)
  }, [])
  const add = useCallback(
    (product: Product, color = defaultColor(product)) =>
      run(() => {
        const available = products.get(product.handle)
        if (
          !available ||
          !available.colors.some((entry) => entry.name === color)
        )
          throw new Error("Выбранный вариант недоступен.")
        const current = linesRef.current.find(
          (line) => line.handle === product.handle && line.color === color,
        )
        const quantity = (current?.quantity || 0) + 1
        if (quantity > Math.min(10, getStock(available, color)))
          throw new Error("Добавлено максимальное доступное количество.")
        replaceLines(
          current
            ? linesRef.current.map((line) =>
                line === current ? { ...line, quantity } : line,
              )
            : [
                ...linesRef.current,
                { handle: product.handle, color, quantity },
              ],
        )
        setToast(`${product.name} — в корзине`)
        setDrawer(true)
      }),
    [run, replaceLines],
  )
  const update = useCallback(
    (id: string, quantity: number) =>
      run(() => {
        if (!Number.isInteger(quantity) || quantity < 0)
          throw new Error("Укажите целое количество товаров.")
        const current = linesRef.current.find((line) => lineId(line) === id)
        if (!current) return
        if (
          quantity >
          Math.min(10, getStock(products.get(current.handle)!, current.color))
        )
          throw new Error("Больше нет в наличии.")
        replaceLines(
          quantity
            ? linesRef.current.map((line) =>
                line === current ? { ...line, quantity } : line,
              )
            : linesRef.current.filter((line) => line !== current),
        )
      }),
    [run, replaceLines],
  )
  const applyPromo = useCallback(
    (code: string) =>
      run(() => {
        const normalized = code.trim().toUpperCase()
        if (normalized && normalized !== config.promotion?.code)
          throw new Error(
            `Промокод не найден. Попробуйте ${config.promotion?.code || "другой код"}.`,
          )
        save("nord.promo.v1", normalized)
        promoRef.current = normalized
        setPromo(normalized)
      }),
    [config.promotion?.code, run],
  )
  const getCheckoutOptions = useCallback(
    async (signal?: AbortSignal) => {
      signal?.throwIfAborted()
      return options(linesRef.current, promoRef.current, config)
    },
    [config],
  )
  const prepareCheckout = useCallback(
    (input: CheckoutDetails) =>
      run(() => {
        if (!linesRef.current.length)
          throw new Error("Добавьте товары в корзину.")
        const available = options(linesRef.current, promoRef.current, config)
        const shipping = available.shipping.find((option) =>
          input.shippingOptionId
            ? option.id === input.shippingOptionId
            : option.code === input.delivery,
        )
        if (!shipping) throw new Error("Выберите доступный способ доставки.")
        if (
          !input.firstName.trim() ||
          !input.lastName.trim() ||
          !input.email.includes("@") ||
          !input.phone.trim()
        )
          throw new Error("Заполните контактные данные.")
        const next =
          shipping.code === "pickup"
            ? {
                ...input,
                city: config.showroom.city,
                address: config.showroom.address,
                postalCode: config.showroom.postalCode,
              }
            : { ...input }
        if (
          !next.city.trim() ||
          !next.address.trim() ||
          !next.postalCode.trim()
        )
          throw new Error("Заполните адрес доставки.")
        next.delivery = shipping.code
        next.shippingOptionId = shipping.id
        save(detailsKey, next)
        detailsRef.current = next
        setDetails(next)
        return available
      }),
    [config, run],
  )

  const finishOrder = useCallback(
    (id: string) => {
      // Keep the receipt marker until its page has actually opened and read it.
      setRecovery(true)
      setDrawer(false)
      router.push(`/order/demo/confirmed?id=${encodeURIComponent(id)}`)
    },
    [router],
  )
  const completeCheckout = useCallback(
    (providerId: string) =>
      run(() => {
        if (completion.current) return finishOrder(completion.current)
        const prepared = detailsRef.current
        if (!prepared || !linesRef.current.length)
          throw new Error("Проверьте корзину и адрес перед оформлением.")
        if (
          !(config.checkout || demoConfig.checkout)?.payment.some(
            (provider) => provider.id === providerId,
          )
        )
          throw new Error("Выберите тестовую оплату.")
        const receipt: Receipt = {
          id: `NORD-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          date: new Date().toISOString(),
          delivery: prepared.delivery,
          total: totals(
            linesRef.current,
            promoRef.current,
            prepared.delivery,
            config,
          ).total,
          items: linesRef.current.map((line) => ({
            name: products.get(line.handle)!.name,
            color: line.color,
            quantity: line.quantity,
            price: getPrice(products.get(line.handle)!, line.color),
          })),
        }
        save(`nord.receipt.${receipt.id}`, receipt)
        save(pendingKey, receipt.id)
        completion.current = receipt.id
        setRecovery(true)
        finishOrder(receipt.id)
      }, true),
    [config, finishOrder, run],
  )
  const resumeOrder = useCallback(
    () =>
      run(() => {
        if (completion.current) finishOrder(completion.current)
      }, true),
    [finishOrder, run],
  )
  const acknowledgeOrder = useCallback(
    async (id: string) => {
      if (completion.current !== id) return
      replaceLines([])
      save("nord.promo.v1", "")
      save(detailsKey, null)
      save(pendingKey, "")
      promoRef.current = ""
      detailsRef.current = null
      completion.current = ""
      setPromo("")
      setDetails(null)
      setRecovery(false)
    },
    [replaceLines],
  )
  const refreshCart = useCallback(
    () => run(() => replaceLines(sanitize(linesRef.current))),
    [run, replaceLines],
  )
  const cart = useMemo(
    () => snapshot(lines, promo, details, config),
    [lines, promo, details, config],
  )
  return (
    <NordContext.Provider
      value={{
        ...preferences,
        mode: "demo",
        catalogScope: "demo",
        config,
        cart,
        cartError,
        pending,
        storageReady: preferences.storageReady && hydrated,
        drawer,
        setDrawer,
        toast,
        recovery,
        recovering: recovery && pending,
        add,
        update,
        applyPromo,
        refreshCart,
        getCheckoutOptions,
        prepareCheckout,
        completeCheckout,
        resumeOrder,
        acknowledgeOrder,
        loadCatalog,
      }}
    >
      {children}
    </NordContext.Provider>
  )
}

export default DemoProvider
