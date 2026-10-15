import type { Category } from "./types"

const queryNames = [
  "q",
  "category",
  "material",
  "room",
  "color",
  "minPrice",
  "maxPrice",
  "inStock",
  "collection",
  "sort",
] as const

export function catalogQuery(
  values: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams()
  for (const name of queryNames) {
    const value = values[name]
    if (Array.isArray(value) ? value.length : value)
      params.set(name, Array.isArray(value) ? value.join(",") : value!)
  }
  return params
}

/** Keep metadata identical after server navigation and native history updates. */
export function catalogMetadata(
  params: URLSearchParams,
  categories: Category[],
) {
  const collection = params.get("collection")
  const category = categories.find(
    (entry) => entry.id === params.get("category"),
  )
  const title =
    collection === "favorites"
      ? "Избранное"
      : collection === "new"
        ? "Новинки"
        : collection === "sale"
          ? "Особые цены"
          : category?.name || "Каталог"
  const filtered =
    queryNames.some((name) => name !== "category" && params.has(name)) ||
    (params.has("category") && !category)
  const canonical = `/store${!filtered && category ? `?category=${encodeURIComponent(category.id)}` : ""}`
  return { title, filtered, canonical }
}
