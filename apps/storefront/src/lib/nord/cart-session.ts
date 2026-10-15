"use server"

import { updateCart } from "@lib/data/cart"
import { getCartId, removeCartId, setCartId } from "@lib/data/cookies"
import { FetchError } from "@medusajs/js-sdk"
import type { HttpTypes } from "@medusajs/types"
import type { ActionResult } from "./cart-actions"
import { storefrontData } from "./data"
import { readCart } from "./cart-data"

/** Restore the existing cart before any operation is allowed to create one. */
export async function restoreNordSession(
  legacyCartId?: string,
): Promise<
  ActionResult<{ cart: HttpTypes.StoreCart | null; pending: boolean }>
> {
  let cart: HttpTypes.StoreCart | undefined
  try {
    const cookieId = await getCartId()
    const id = cookieId || legacyCartId
    if (!id) return { ok: true, value: { cart: null, pending: false } }
    if (!/^cart_[a-zA-Z0-9]{1,100}$/.test(id)) {
      throw new Error(
        "Не удалось восстановить корзину: некорректный идентификатор.",
      )
    }

    try {
      cart = await readCart(id)
    } catch (reason) {
      // Only the initial GET can establish that this cart no longer exists.
      if (!(reason instanceof FetchError) || reason.status !== 404) throw reason
      if (cookieId) await removeCartId()
      return { ok: true, value: { cart: null, pending: false } }
    }

    // Persist legacy ownership before config/update requests can fail. Never
    // replace a completed cart: its ID is needed for idempotent order recovery.
    await setCartId(cart.id)
    if (cart.completed_at) {
      return { ok: true, value: { cart, pending: true } }
    }

    const config = await storefrontData()
    if (!config.regionId)
      throw new Error("Регион магазина временно недоступен.")
    if (cart.region_id !== config.regionId) {
      await updateCart({ region_id: config.regionId })
      cart = await readCart(id)
    }
    return { ok: true, value: { cart, pending: !!cart.completed_at } }
  } catch (reason) {
    const raw = reason instanceof Error ? reason.message : ""
    const error =
      !raw || /fetch|network|timeout|ECONN|ENOTFOUND/i.test(raw)
        ? "Не удалось восстановить корзину. Проверьте соединение и повторите попытку."
        : raw
    return { ok: false, error, ...(cart ? { cart } : {}) }
  }
}
