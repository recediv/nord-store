const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(
  /^\/+|\/+$/g,
  "",
)
const prefix = basePath ? `/${basePath}` : ""

/** Prefix only paths to this storefront's public resources. */
export function assetPath(path: string) {
  if (!prefix || !path.startsWith("/") || path.startsWith("//")) return path
  if (path === prefix || path.startsWith(`${prefix}/`)) return path
  return `${prefix}${path}`
}
