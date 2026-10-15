export type Color = { name: string; hex: string }
export type Category = { id: string; name: string; description: string; image: string }
export type Review = { name: string; rating: number; text: string }
export type ShowcaseScene = {
  handle: string
  image: string
  bg: string
  ink: string
  muted: string
  cutout: boolean
}
export type StorefrontConfig = {
  categories: Category[]
  categoryCounts: Record<string, number>
  scenes: ShowcaseScene[]
  accentProduct: string
  regionId: string
  returnDays: number
  freeShippingFrom?: number | null
  checkout?: CheckoutOptions
  cities?: string[]
  promotion?: { code: string; percentage: number }
  showroom: { city: string; address: string; postalCode: string; hours: string }
}
export type ShippingOption = {
  id: string
  code: string
  name: string
  description: string
  amount: number
}
export type CheckoutOptions = {
  shipping: ShippingOption[]
  payment: { id: string; name: string }[]
}
export type Product = {
  handle: string
  name: string
  subtitle: string
  category: string
  categoryName?: string
  price: number
  comparePrice: number | null
  image: string
  colors: Color[]
  material: string
  room: string
  stock: number
  isNew: boolean
  featured: boolean
  rating: number
  reviews: number
  description: string
  specs: Record<string, string>
  reviewEntries?: Review[]
  variants?: {
    id: string
    color: string
    price: number
    comparePrice?: number | null
    stock: number
  }[]
}
export type Facet = 'category' | 'material' | 'room' | 'color'
export type PriceFacet = {
  min: number
  max: number
  count: number
  bins: { from: number; to: number; count: number }[]
}
export type FacetDefinition = {
  id: Facet
  title: string
  options: { value: string; label: string; hex?: string; count: number }[]
}
export type CatalogResult = {
  generatedAt: number
  products: Product[]
  count: number
  offset: number
  limit: number
  facets: FacetDefinition[]
  price: PriceFacet
  priceLimit: number
  availableCount: number
  categoryCounts: Record<string, number>
  categories?: Category[]
}
export type CatalogQuery = {
  q?: string
  category?: string
  material?: string
  room?: string
  color?: string
  minPrice?: string
  maxPrice?: string
  inStock?: string
  collection?: string
  sort?: string
  favorites?: string
  handles?: string
  exclude?: string
  similarTo?: string
  offset?: string
  limit?: string
}
