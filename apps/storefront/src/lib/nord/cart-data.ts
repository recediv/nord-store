import "server-only"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/data/cookies"
import type { HttpTypes } from "@medusajs/types"

/** Recovery decisions must use current Medusa state, never the Next Data Cache. */
export async function readCart(id: string) {
  const { cart } = await sdk.client.fetch<HttpTypes.StoreCartResponse>(
    `/store/carts/${id}`,
    {
      method: "GET",
      query: {
        fields:
          "*items,*region,*items.product,*items.variant,*items.metadata,+items.total,*promotions,+shipping_methods.name",
      },
      headers: await getAuthHeaders(),
      cache: "no-store",
    },
  )
  return cart
}
