import catalog from "../../../../backend/src/data/catalog.json"
import type {
  CatalogResult,
  Facet,
  FacetDefinition,
  Product,
  StorefrontConfig,
} from "./types"
import { defaultColor, getComparePrice, getPrice, getStock } from "./format"

export const demoProducts: Product[] = catalog.products.map((product) => ({
  ...product,
  specs: Object.fromEntries(
    Object.entries(product.specs).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ),
  categoryName: catalog.categories.find(
    (category) => category.id === product.category,
  )?.name,
  variants: product.colors.map((color, index) => ({
    id: `demo-${product.handle}-${index + 1}`,
    color: color.name,
    price: product.price,
    comparePrice: product.comparePrice,
    stock: product.stock,
  })),
}))

const categoryCounts = Object.fromEntries(
  catalog.categories.map((category) => [
    category.id,
    demoProducts.filter((product) => product.category === category.id).length,
  ]),
)
export const demoConfig: StorefrontConfig = {
  ...catalog.storefront,
  categories: catalog.categories,
  categoryCounts,
}

const list = (value: string | null) =>
  new Set(
    (value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
const numeric = (value: string | null, fallback: number, max = 1e9) =>
  value?.trim() && Number.isFinite(Number(value))
    ? Math.max(0, Math.min(max, Number(value)))
    : fallback

/** File data is used only by the static demo; the live adapter queries Medusa. */
export function demoCatalog(params: URLSearchParams): CatalogResult {
  const handles = params.has("handles")
    ? list(params.get("handles"))
    : undefined
  const excluded = list(params.get("exclude"))
  const favoriteHandles = list(params.get("favorites"))
  const similar = demoProducts.find(
    (product) => product.handle === params.get("similarTo"),
  )
  const collection = params.get("collection")
  const query = (params.get("q") || "").trim().toLocaleLowerCase("ru")
  const selected = Object.fromEntries(
    (["category", "material", "room", "color"] as Facet[]).map((facet) => [
      facet,
      list(params.get(facet)),
    ]),
  ) as Record<Facet, Set<string>>
  const min = numeric(params.get("minPrice"), 0)
  const max = numeric(params.get("maxPrice"), Infinity)
  const stockOnly = params.get("inStock") === "true"
  const source = demoProducts.filter((product) => {
    const color = defaultColor(product)
    const price = getPrice(product, color)
    const compare = getComparePrice(product, color)
    return (
      (!handles || handles.has(product.handle)) &&
      !excluded.has(product.handle) &&
      (!similar || product.category === similar.category) &&
      (!query ||
        [
          product.name,
          product.subtitle,
          product.description,
          product.material,
        ].some((value) => value.toLocaleLowerCase("ru").includes(query))) &&
      (collection === "favorites"
        ? favoriteHandles.has(product.handle)
        : collection === "new"
          ? product.isNew
          : collection === "featured"
            ? product.featured
            : collection === "sale"
              ? compare !== null && compare > price
              : true)
    )
  })
  const matches = (product: Product, omit?: Facet | "price" | "stock") => {
    const color = defaultColor(product)
    const price = getPrice(product, color)
    return (
      (["category", "material", "room", "color"] as Facet[]).every(
        (facet) =>
          facet === omit ||
          !selected[facet].size ||
          (facet === "color"
            ? product.colors.some((entry) => selected.color.has(entry.name))
            : selected[facet].has(product[facet])),
      ) &&
      (omit === "price" || (price >= min && price <= max)) &&
      (omit === "stock" || !stockOnly || getStock(product, color) > 0)
    )
  }
  const filtered = source.filter((product) => matches(product))
  const sort = params.get("sort")
  filtered.sort((a, b) => {
    if (sort === "price-asc" || sort === "price-desc") {
      const difference =
        getPrice(a, defaultColor(a)) - getPrice(b, defaultColor(b))
      return sort === "price-desc" ? -difference : difference
    }
    if (sort === "new") return Number(b.isNew) - Number(a.isNew)
    if (sort === "rating") return b.rating - a.rating
    return Number(b.featured) - Number(a.featured) || b.reviews - a.reviews
  })
  const definitions: Omit<FacetDefinition, "options">[] = [
    { id: "category", title: "Категория" },
    { id: "material", title: "Материал" },
    { id: "room", title: "Комната" },
    { id: "color", title: "Цвет" },
  ]
  const facets: FacetDefinition[] = definitions.map((definition) => {
    const values =
      definition.id === "category"
        ? catalog.categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))
        : definition.id === "color"
          ? Array.from(
              new Map(
                source.flatMap((product) =>
                  product.colors.map(
                    (color) =>
                      [
                        color.name,
                        {
                          value: color.name,
                          label: color.name,
                          hex: color.hex,
                        },
                      ] as const,
                  ),
                ),
              ).values(),
            )
          : Array.from(
              new Set(
                source.map(
                  (product) => product[definition.id as "material" | "room"],
                ),
              ),
            )
              .sort()
              .map((value) => ({ value, label: value }))
    const counts = new Map<string, number>()
    for (const product of source.filter((product) =>
      matches(product, definition.id),
    )) {
      const values =
        definition.id === "color"
          ? Array.from(new Set(product.colors.map((color) => color.name)))
          : [product[definition.id]]
      for (const value of values)
        counts.set(value, (counts.get(value) || 0) + 1)
    }
    return {
      ...definition,
      options: values.map((option) => ({
        ...option,
        count: counts.get(option.value) || 0,
      })),
    }
  })
  const priceMatches = source.filter((product) => matches(product, "price"))
  const prices = priceMatches.map((product) =>
    getPrice(product, defaultColor(product)),
  )
  const lower = prices.length ? Math.min(...prices) : 0
  const upper = prices.length ? Math.max(...prices) : 0
  const binCount = lower === upper ? 1 : 12
  const width = (upper - lower) / binCount
  const bins = Array.from({ length: binCount }, (_, index) => ({
    from: Math.round(lower + width * index),
    to:
      index === binCount - 1 ? upper : Math.round(lower + width * (index + 1)),
    count: 0,
  }))
  for (const price of prices)
    bins[
      width ? Math.min(binCount - 1, Math.floor((price - lower) / width)) : 0
    ].count++
  const limit = Math.max(
    1,
    Math.min(24, Math.trunc(numeric(params.get("limit"), 12)) || 12),
  )
  const offset = Math.trunc(numeric(params.get("offset"), 0))
  return {
    generatedAt: Date.now(),
    products: filtered.slice(offset, offset + limit),
    count: filtered.length,
    limit,
    offset,
    facets,
    price: { min: lower, max: upper, count: prices.length, bins },
    availableCount: source.filter(
      (product) =>
        matches(product, "stock") &&
        getStock(product, defaultColor(product)) > 0,
    ).length,
    priceLimit: Math.max(
      80000,
      ...demoProducts.map((product) =>
        getPrice(product, defaultColor(product)),
      ),
    ),
    categories: catalog.categories,
    categoryCounts,
  }
}

export function demoHomeData() {
  return {
    objects: demoConfig.scenes.flatMap((scene) => {
      const product = demoProducts.find(
        (product) => product.handle === scene.handle,
      )
      return product ? [product] : []
    }),
    fresh: demoCatalog(
      new URLSearchParams({ collection: "new", inStock: "true", limit: "4" }),
    ),
    picks: demoCatalog(
      new URLSearchParams({
        collection: "featured",
        inStock: "true",
        limit: "4",
      }),
    ),
  }
}
