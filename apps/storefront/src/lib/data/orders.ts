"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { getAuthHeaders, getCacheOptions, getCacheTag } from "./cookies"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"

async function invalidateTransferCaches(customerChanged = false) {
  try {
    const tags = await Promise.all(
      (customerChanged ? ["orders", "customers"] : ["orders"]).map(getCacheTag),
    )
    for (const tag of tags) if (tag) revalidateTag(tag)
  } catch (error) {
    // A committed transfer uses a one-time token; cache failure cannot undo it.
    console.error("Unable to invalidate order transfer cache", error)
  }
}

function transferError(reason: unknown) {
  return reason instanceof Error ? reason.message : "Не удалось обновить заказ."
}

export const retrieveOrder = async (id: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, unknown>,
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "*items,+items.metadata,*items.variant,*items.product",
        ...filters,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}

export const createTransferRequest = async (
  state: {
    success: boolean
    error: string | null
    order: HttpTypes.StoreOrder | null
  },
  formData: FormData,
): Promise<{
  success: boolean
  error: string | null
  order: HttpTypes.StoreOrder | null
}> => {
  const id = formData.get("order_id") as string

  if (!id) {
    return { success: false, error: "Order ID is required", order: null }
  }

  const headers = await getAuthHeaders()

  return await sdk.store.order
    .requestTransfer(
      id,
      {},
      {
        fields: "id, email",
      },
      headers,
    )
    .then(async ({ order }) => {
      await invalidateTransferCaches()
      return { success: true, error: null, order }
    })
    .catch((err: unknown) => ({
      success: false,
      error: transferError(err),
      order: null,
    }))
}

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(async ({ order }) => {
      await invalidateTransferCaches(true)
      return { success: true, error: null, order }
    })
    .catch((err: unknown) => ({
      success: false,
      error: transferError(err),
      order: null,
    }))
}

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(async ({ order }) => {
      await invalidateTransferCaches(true)
      return { success: true, error: null, order }
    })
    .catch((err: unknown) => ({
      success: false,
      error: transferError(err),
      order: null,
    }))
}
