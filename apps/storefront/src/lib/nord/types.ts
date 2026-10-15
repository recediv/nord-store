export type {
  Product,
  Color,
  Category,
  Review,
  StorefrontConfig,
  CatalogResult,
  CatalogQuery,
  Facet,
  FacetDefinition,
  PriceFacet,
  CheckoutOptions,
  ShippingOption,
  ShowcaseScene,
} from "../../../../backend/src/catalog-contract"

export type CheckoutDetails = {
  firstName: string
  lastName: string
  email: string
  phone: string
  city: string
  address: string
  postalCode: string
  delivery: string
  shippingOptionId?: string
}
