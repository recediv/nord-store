import "server-only"
import { cache } from "react"
import { createHash } from "node:crypto"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/data/cookies"
import type { CatalogResult, StorefrontConfig } from "./types"

export const storefrontData = cache(async () =>
  sdk.client.fetch<StorefrontConfig>("/store/nord/config", {
    cache: "force-cache",
    next: { revalidate: 60, tags: ["nord-config"] },
  }),
)
export const catalogData = async (params = new URLSearchParams()) =>
  sdk.client.fetch<CatalogResult>("/store/nord/catalog", {
    query: Object.fromEntries(params),
    headers: await getAuthHeaders(),
    cache: "no-store",
  })

// Partition browser snapshots across sign-in/out without exposing credentials.
// Medusa still validates authentication and determines the actual pricing context.
export const getCatalogScope = cache(async () => {
  const headers = await getAuthHeaders()
  return headers.authorization
    ? createHash("sha256").update(headers.authorization).digest("hex")
    : "guest"
})

export async function homeData() {
  const config = await storefrontData()
  const [objects, fresh, picks] = await Promise.all([
    catalogData(
      new URLSearchParams({
        handles: [
          ...config.scenes.map((scene) => scene.handle),
          config.accentProduct,
        ]
          .filter(Boolean)
          .join(","),
        limit: "24",
      }),
    ),
    catalogData(
      new URLSearchParams({ collection: "new", inStock: "true", limit: "4" }),
    ),
    catalogData(
      new URLSearchParams({
        collection: "featured",
        inStock: "true",
        limit: "4",
      }),
    ),
  ])
  return { objects: objects.products, fresh, picks }
}
