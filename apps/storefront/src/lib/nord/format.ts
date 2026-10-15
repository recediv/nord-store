import type { Product } from "./types"

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
export const money = (value: number) => currency.format(value)
export const getPrice = (product: Product, color: string) =>
  product.variants?.find((variant) => variant.color === color)?.price ??
  product.price
export const getStock = (product: Product, color: string) =>
  product.variants?.find((variant) => variant.color === color)?.stock ??
  product.stock
export function getComparePrice(product: Product, color: string) {
  const variant = product.variants?.find((entry) => entry.color === color)
  return variant ? (variant.comparePrice ?? null) : product.comparePrice
}
export function defaultColor(product: Product) {
  return (
    product.variants?.find((variant) => variant.stock > 0)?.color ||
    product.colors[0]?.name ||
    ""
  )
}
export function storePath(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return href
  return href
    .replace(/^\/catalog(?=[/?#]|$)/, "/store")
    .replace(/^\/product\//, "/products/")
}
