"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { HttpTypes } from "@medusajs/types"
import type {
  CatalogResult,
  CheckoutDetails,
  Product,
  StorefrontConfig,
} from "@lib/nord/types"
import { defaultColor, getStock } from "@lib/nord/format"
import { NordContext } from "./provider"
import { usePreferences } from "./preferences"
import { restoreNordSession } from "@lib/nord/cart-session"
import {
  addNordItem,
  updateNordItem,
  promoNordCart,
  nordCheckoutOptions,
  prepareNordCheckout,
  beginNordOrder,
  finishNordOrder,
  acknowledgeNordOrder,
  type ActionResult,
} from "@lib/nord/cart-actions"

async function loadCatalog(
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<CatalogResult> {
  const failure = "Не удалось загрузить товары. Попробуйте ещё раз."
  const response = await fetch(`/api/catalog?${params}`, { signal })
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(failure)
  let result
  try {
    result = await response.json()
  } catch (reason) {
    if (signal?.aborted) throw reason
    throw new Error(failure)
  }
  if (!response.ok)
    throw new Error(
      typeof result?.message === "string" ? result.message : failure,
    )
  if (!result || !Array.isArray(result.products)) throw new Error(failure)
  return result
}
function legacyCartId() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("nord.medusa.cart.v1") || "null",
    )
    return typeof saved === "string" ? saved : ""
  } catch {
    return ""
  }
}
function clearLegacyCartId() {
  try {
    localStorage.removeItem("nord.medusa.cart.v1")
  } catch {
    /* The native cookie owns the restored ID. */
  }
}
export function NativeProvider({
  children,
  config,
  initialCart,
  initialError = "",
  initialRecovery = false,
  catalogScope,
}: {
  children: ReactNode
  config: StorefrontConfig
  initialCart: HttpTypes.StoreCart | null
  initialError?: string
  initialRecovery?: boolean
  catalogScope: string
}) {
  const preferences = usePreferences(config)
  const [cart, setCart] = useState(initialCart)
  const [cartError, setError] = useState(initialError)
  const [pending, setPending] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [toast, setToast] = useState("")
  const [recovery, setRecovery] = useState(initialRecovery)
  const [recovering, setRecovering] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const session = useRef<Promise<void> | null>(null)
  const queue = useRef(Promise.resolve())
  const operations = useRef(0)
  const completion = useRef<Promise<void> | null>(null)
  const startupRecovery = useRef(initialRecovery)
  const recoveryRef = useRef(recovery)
  recoveryRef.current = recovery
  const router = useRouter()
  useEffect(() => {
    setCart(initialCart)
  }, [initialCart])
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(""), 4000)
      return () => clearTimeout(timeout)
    }
  }, [toast])
  const unwrap = useCallback(<T,>(result: ActionResult<T>): T => {
    if (result.ok) {
      setError("")
      return result.value
    }
    if (result.cart) setCart(result.cart)
    if (typeof result.pending === "boolean") {
      recoveryRef.current = result.pending
      setRecovery(result.pending)
      if (!result.pending) startupRecovery.current = false
    }
    setError(result.error)
    throw new Error(result.error)
  }, [])
  const ensureSession = useCallback((): Promise<void> => {
    if (session.current) return session.current
    const operation: Promise<void> = Promise.resolve()
      .then(async () => {
        const legacyId = legacyCartId()
        if (
          !initialError &&
          (!initialCart || initialCart.region_id === config.regionId) &&
          (initialCart || !legacyId)
        ) {
          if (initialCart) clearLegacyCartId()
          return
        }
        const response = await restoreNordSession(legacyId || undefined)
        // A completed explicit refresh owns newer state than this older attempt.
        if (session.current !== operation) return
        const result = unwrap(response)
        setCart(result.cart)
        if (result.pending) {
          recoveryRef.current = true
          setRecovery(true)
          startupRecovery.current = true
        }
        clearLegacyCartId()
      })
      .catch((reason) => {
        if (session.current === operation) {
          session.current = null
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось восстановить корзину. Повторите попытку.",
          )
        }
        throw reason
      })
      .finally(() => setSessionReady(true))
    session.current = operation
    return operation
  }, [config.regionId, initialCart, initialError, unwrap])
  useEffect(() => {
    void ensureSession().catch(() => {})
  }, [ensureSession])
  const mutate = useCallback(
    <T,>(action: () => Promise<T>): Promise<T> => {
      operations.current++
      setPending(true)
      const operation = queue.current
        .catch(() => {})
        .then(async () => {
          await ensureSession()
          if (recoveryRef.current || completion.current)
            throw new Error(
              "Проверьте результат оформления перед изменением корзины.",
            )
          return action()
        })
      queue.current = operation.then(
        () => {},
        () => {},
      )
      return operation.finally(() => {
        if (--operations.current === 0) setPending(false)
      })
    },
    [ensureSession],
  )
  const add = useCallback(
    (product: Product, color = defaultColor(product)) =>
      mutate(async () => {
        const variant = product.variants?.find((entry) => entry.color === color)
        if (!variant || getStock(product, color) < 1)
          throw new Error("Этот вариант товара закончился.")
        setCart(unwrap(await addNordItem(variant.id)))
        setToast(`${product.name} — в корзине`)
        setDrawer(true)
      }),
    [mutate, unwrap],
  )
  const update = useCallback(
    (lineId: string, quantity: number) =>
      mutate(async () => {
        setCart(unwrap(await updateNordItem(lineId, quantity)))
      }),
    [mutate, unwrap],
  )
  const applyPromo = useCallback(
    (code: string) =>
      mutate(async () => {
        setCart(unwrap(await promoNordCart(code)))
      }),
    [mutate, unwrap],
  )
  const refreshCart = useCallback(async () => {
    const result = unwrap(await restoreNordSession(legacyCartId() || undefined))
    setCart(result.cart)
    clearLegacyCartId()
    session.current = Promise.resolve()
    setSessionReady(true)
    if (result.pending) {
      recoveryRef.current = true
      setRecovery(true)
      startupRecovery.current = true
    }
  }, [unwrap])
  const getCheckoutOptions = useCallback(
    async (signal?: AbortSignal) => {
      signal?.throwIfAborted()
      await ensureSession()
      const result = unwrap(await nordCheckoutOptions())
      signal?.throwIfAborted()
      return result
    },
    [ensureSession, unwrap],
  )
  const prepareCheckout = useCallback(
    (details: CheckoutDetails) =>
      mutate(async () => {
        const result = unwrap(await prepareNordCheckout(details))
        setCart(result.cart)
        return result.options
      }),
    [mutate, unwrap],
  )
  const complete = useCallback(
    (providerId?: string): Promise<void> => {
      if (completion.current) return completion.current
      setRecovering(true)
      const operation = (async () => {
        await queue.current.catch(() => {})
        await ensureSession()
        if (providerId && !recoveryRef.current)
          unwrap(await beginNordOrder(providerId))
        recoveryRef.current = true
        setRecovery(true)
        const result = unwrap(await finishNordOrder())
        setDrawer(false)
        router.replace(`/order/${result.orderId}/confirmed`)
      })().finally(() => {
        completion.current = null
        setRecovering(false)
      })
      completion.current = operation
      return operation
    },
    [router, unwrap, ensureSession],
  )
  const resumeOrder = useCallback(() => complete(), [complete])
  const completeCheckout = useCallback(
    (providerId: string) => complete(providerId),
    [complete],
  )
  const acknowledgeOrder = useCallback(
    async (orderId: string) => {
      startupRecovery.current = false
      const result = unwrap(await acknowledgeNordOrder(orderId))
      recoveryRef.current = result.pending
      setRecovery(result.pending)
      if (result.completed)
        setCart((current) => (current?.id === result.cartId ? null : current))
    },
    [unwrap],
  )
  useEffect(() => {
    if (preferences.storageReady && sessionReady && startupRecovery.current) {
      startupRecovery.current = false
      void resumeOrder().catch(() => {})
    }
  }, [preferences.storageReady, sessionReady, recovery, resumeOrder])
  return (
    <NordContext.Provider
      value={{
        mode: "medusa",
        catalogScope,
        config,
        cart,
        cartError,
        ...preferences,
        pending: pending || !sessionReady,
        storageReady: preferences.storageReady && sessionReady,
        drawer,
        setDrawer,
        toast,
        recovery,
        recovering,
        loadCatalog,
        add,
        update,
        applyPromo,
        refreshCart,
        getCheckoutOptions,
        prepareCheckout,
        completeCheckout,
        resumeOrder,
        acknowledgeOrder,
      }}
    >
      {children}
    </NordContext.Provider>
  )
}
