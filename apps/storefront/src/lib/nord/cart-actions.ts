"use server"

import { cookies } from "next/headers"
import { revalidateTag } from "next/cache"
import { sdk } from "@lib/config"
import { FetchError } from "@medusajs/js-sdk"
import {
  addToCart,
  updateLineItem,
  deleteLineItem,
  applyPromotions,
  retrieveCart,
  updateCart,
  setShippingMethod,
  initiatePaymentSession,
} from "@lib/data/cart"
import {
  getAuthHeaders,
  getCacheTag,
  getCartId,
  removeCartId,
} from "@lib/data/cookies"
import { storefrontData } from "./data"
import { readCart } from "./cart-data"
import type { HttpTypes } from "@medusajs/types"
import type { CheckoutDetails, CheckoutOptions } from "./types"

type Pending = { cartId: string; orderId?: string }
export type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; cart?: HttpTypes.StoreCart; pending?: boolean }
const pendingKey = "_nord_checkout_pending"
function message(reason: unknown) {
  const raw = reason instanceof Error ? reason.message : ""
  return !raw || /fetch|network|timeout|ECONN|ENOTFOUND/i.test(raw)
    ? "Не удалось связаться с магазином. Проверьте соединение и повторите попытку."
    : raw
}
async function pendingOrder(): Promise<Pending | null> {
  try {
    const value = JSON.parse((await cookies()).get(pendingKey)?.value || "null")
    return value &&
      typeof value.cartId === "string" &&
      /^cart_[a-zA-Z0-9]+$/.test(value.cartId)
      ? value
      : null
  } catch {
    return null
  }
}
async function rememberPending(value: Pending) {
  ;(await cookies()).set(pendingKey, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}
async function clearPending() {
  ;(await cookies()).delete(pendingKey)
}
async function invalidate(...names: string[]) {
  const tags = await Promise.all(names.map(getCacheTag))
  for (const tag of tags) {
    if (tag) revalidateTag(tag)
  }
}
async function finishKnownOrder(cartId: string, orderId: string) {
  // Keep the result recoverable if cache invalidation or cleanup needs a retry.
  await rememberPending({ cartId, orderId })
  await invalidate("carts", "orders", "customers")
  if ((await getCartId()) === cartId) await removeCartId()
}
async function mutable() {
  if (await pendingOrder())
    throw new Error(
      "Результат оформления пока неизвестен. Проверьте заказ перед изменением корзины.",
    )
}
async function optionsFor(cartId: string, signal?: AbortSignal) {
  return sdk.client.fetch<CheckoutOptions>("/store/nord/checkout-options", {
    query: { cart_id: cartId },
    headers: await getAuthHeaders(),
    cache: "no-store",
    signal,
  })
}
export async function bootstrapCart() {
  const pending = await pendingOrder()
  try {
    const cart = await retrieveCart()
    return { cart, error: "", pending: !!pending || !!cart?.completed_at }
  } catch (reason) {
    return { cart: null, error: message(reason), pending: !!pending }
  }
}
export async function refreshNordCart(): Promise<
  ActionResult<HttpTypes.StoreCart | null>
> {
  try {
    return { ok: true, value: await retrieveCart() }
  } catch (reason) {
    return { ok: false, error: message(reason) }
  }
}
export async function addNordItem(
  variantId: string,
): Promise<ActionResult<HttpTypes.StoreCart>> {
  try {
    await mutable()
    const config = await storefrontData()
    const cart = await addToCart({
      variantId,
      quantity: 1,
      countryCode: "ru",
      regionId: config.regionId,
    })
    return { ok: true, value: cart }
  } catch (reason) {
    return { ok: false, error: message(reason) }
  }
}
export async function updateNordItem(
  lineId: string,
  quantity: number,
): Promise<ActionResult<HttpTypes.StoreCart>> {
  try {
    await mutable()
    const cart =
      quantity <= 0
        ? await deleteLineItem(lineId)
        : await updateLineItem({ lineId, quantity })
    return { ok: true, value: cart }
  } catch (reason) {
    return { ok: false, error: message(reason) }
  }
}
export async function promoNordCart(
  code: string,
): Promise<ActionResult<HttpTypes.StoreCart>> {
  try {
    await mutable()
    const cart = await applyPromotions(code.trim() ? [code.trim()] : [])
    if (
      code.trim() &&
      !cart.promotions?.some(
        (promo) => promo.code?.toLowerCase() === code.trim().toLowerCase(),
      )
    )
      return {
        ok: false,
        error: "Промокод не найден или не подходит к заказу.",
        cart,
      }
    return { ok: true, value: cart }
  } catch (reason) {
    return { ok: false, error: message(reason) }
  }
}
export async function nordCheckoutOptions(): Promise<
  ActionResult<CheckoutOptions>
> {
  try {
    await mutable()
    const id = await getCartId()
    if (!id) return { ok: true, value: { shipping: [], payment: [] } }
    return { ok: true, value: await optionsFor(id) }
  } catch (reason) {
    return { ok: false, error: message(reason) }
  }
}
export async function prepareNordCheckout(
  details: CheckoutDetails,
): Promise<
  ActionResult<{ cart: HttpTypes.StoreCart; options: CheckoutOptions }>
> {
  let cart: HttpTypes.StoreCart | undefined
  try {
    await mutable()
    const config = await storefrontData()
    const pickup = details.delivery === "pickup"
    const address: HttpTypes.StoreUpdateCart["shipping_address"] = {
      first_name: details.firstName.trim(),
      last_name: details.lastName.trim(),
      phone: details.phone.trim(),
      country_code: "ru",
      city: pickup ? config.showroom.city : details.city.trim(),
      address_1: pickup ? config.showroom.address : details.address.trim(),
      postal_code: pickup
        ? config.showroom.postalCode
        : details.postalCode.trim(),
    }
    cart = await updateCart({
      email: details.email.trim(),
      shipping_address: address,
      billing_address: address,
    })
    const options = await optionsFor(cart.id)
    const chosen = options.shipping.find(
      (option) => option.id === details.shippingOptionId,
    )
    if (chosen) {
      await setShippingMethod({ cartId: cart.id, shippingMethodId: chosen.id })
      cart = (await retrieveCart()) || cart
    }
    return { ok: true, value: { cart, options } }
  } catch (reason) {
    return { ok: false, error: message(reason), cart }
  }
}
export async function beginNordOrder(
  providerId: string,
): Promise<ActionResult<{ fresh: boolean }>> {
  try {
    if (await pendingOrder()) return { ok: true, value: { fresh: false } }
    const cart = await retrieveCart()
    if (!cart?.items?.length)
      throw new Error("Добавьте товары в корзину перед оформлением.")
    if (cart.completed_at) {
      await rememberPending({ cartId: cart.id })
      return { ok: true, value: { fresh: false } }
    }
    const options = await optionsFor(cart.id)
    if (!options.payment.some((provider) => provider.id === providerId))
      throw new Error("Выберите доступный способ оплаты.")
    await initiatePaymentSession(cart, { provider_id: providerId })
    // This separate action must reach the browser before /complete is sent.
    await rememberPending({ cartId: cart.id })
    return { ok: true, value: { fresh: true } }
  } catch (reason) {
    return { ok: false, error: message(reason) }
  }
}
export async function finishNordOrder(): Promise<
  ActionResult<{ orderId: string }>
> {
  const pending = await pendingOrder()
  const cartId = pending?.cartId || (await getCartId())
  if (!cartId) return { ok: false, error: "Не найдено начатое оформление." }
  try {
    if (pending?.orderId) {
      await finishKnownOrder(cartId, pending.orderId)
      return {
        ok: true,
        value: { orderId: pending.orderId },
      }
    }
    // Medusa's complete workflow restores an existing order idempotently.
    // Recovery must never reinitialize payment or validate catalog stock first.
    const result = await sdk.store.cart.complete(
      cartId,
      {},
      await getAuthHeaders(),
    )
    if (result.type !== "order") {
      if (result.cart.id !== cartId || result.cart.completed_at)
        return {
          ok: false,
          error:
            "Результат оформления пока не подтверждён. Повторите проверку заказа.",
          pending: true,
        }
      await invalidate("carts")
      await clearPending()
      return {
        ok: false,
        error:
          result.error?.message ||
          "Оплата не подтверждена. Проверьте данные и попробуйте снова.",
        cart: result.cart,
        pending: false,
      }
    }
    await finishKnownOrder(cartId, result.order.id)
    return {
      ok: true,
      value: {
        orderId: result.order.id,
      },
    }
  } catch (reason) {
    if (reason instanceof FetchError && reason.status === 400) {
      try {
        const cart = await readCart(cartId)
        if (cart.id === cartId && !cart.completed_at) {
          await invalidate("carts")
          await clearPending()
          return { ok: false, error: message(reason), cart, pending: false }
        }
      } catch {
        // A failed GET cannot establish that the earlier /complete failed.
      }
    }
    return { ok: false, error: message(reason), pending: true }
  }
}
export async function acknowledgeNordOrder(
  orderId: string,
): Promise<
  ActionResult<{ pending: boolean; completed: boolean; cartId?: string }>
> {
  try {
    const pending = await pendingOrder()
    const completed = pending?.orderId === orderId
    if (completed) {
      await finishKnownOrder(pending.cartId, orderId)
      await clearPending()
    }
    return {
      ok: true,
      value: {
        pending: !!pending && !completed,
        completed,
        ...(completed ? { cartId: pending.cartId } : {}),
      },
    }
  } catch (reason) {
    return { ok: false, error: message(reason) }
  }
}
