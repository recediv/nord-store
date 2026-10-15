"use client"

import { createContext, useContext } from "react"
import type { HttpTypes } from "@medusajs/types"
import type {
  CatalogResult,
  CheckoutDetails,
  CheckoutOptions,
  Product,
  StorefrontConfig,
} from "@lib/nord/types"

export type NordState = {
  mode: "medusa" | "demo"
  catalogScope: string
  config: StorefrontConfig
  cart: HttpTypes.StoreCart | null
  cartError: string
  pending: boolean
  storageReady: boolean
  favorites: string[]
  recent: string[]
  city: string
  setCity: (city: string) => void
  toggleFavorite: (handle: string) => void
  recordView: (handle: string) => void
  drawer: boolean
  setDrawer: (open: boolean) => void
  toast: string
  recovery: boolean
  recovering: boolean
  loadCatalog: (
    params: URLSearchParams,
    signal?: AbortSignal,
  ) => Promise<CatalogResult>
  add: (product: Product, color?: string) => Promise<void>
  update: (lineId: string, quantity: number) => Promise<void>
  applyPromo: (code: string) => Promise<void>
  refreshCart: () => Promise<void>
  getCheckoutOptions: (signal?: AbortSignal) => Promise<CheckoutOptions>
  prepareCheckout: (details: CheckoutDetails) => Promise<CheckoutOptions>
  completeCheckout: (providerId: string) => Promise<void>
  resumeOrder: () => Promise<void>
  acknowledgeOrder: (orderId: string) => Promise<void>
}
export const NordContext = createContext<NordState | null>(null)
export function useNord() {
  const value = useContext(NordContext)
  if (!value) throw new Error("NORD provider is missing")
  return value
}
