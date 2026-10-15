// Matches Medusa 2.18 utils/common/validate-handle without changing identity.
// Use a constructor because the storefront TypeScript target is still ES5.
const productHandle = new RegExp(
  "^[\\p{Ll}\\p{Lo}\\p{Lm}\\p{N}]+(?:-[\\p{Ll}\\p{Lo}\\p{Lm}\\p{N}]+)*$",
  "u",
)

export function isProductHandle(value: unknown): value is string {
  return typeof value === "string" && productHandle.test(value)
}

/** Next passes encoded dynamic params; decode once at the routing boundary. */
export function decodeHandleParameter(value: string): string | null {
  try {
    const handle = decodeURIComponent(value)
    return isProductHandle(handle) ? handle : null
  } catch {
    return null
  }
}
