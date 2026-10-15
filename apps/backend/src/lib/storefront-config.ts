import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import type { MedusaStoreRequest } from '@medusajs/framework/http'
import type { Category, StorefrontConfig } from '../catalog-contract'
import { requireStoreRegion, russianRegion } from './store-region'
import { freeShippingThreshold } from './free-shipping'

export async function storefrontConfig(req: MedusaStoreRequest): Promise<StorefrontConfig> {
  const stores = req.scope.resolve(Modules.STORE)
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const [[store], { rows }, candidate] = await Promise.all([
    stores.listStores({}, { take: 1, select: ['metadata'] }),
    db.raw<{ rows: (Category & { count: number })[] }>(
      `SELECT c.handle AS id, c.name, coalesce(c.description, '') AS description,
      coalesce(c.metadata->>'image', min(p.thumbnail), '') AS image, count(DISTINCT p.id)::integer AS count
      FROM product_category c LEFT JOIN product_category_product cp ON cp.product_category_id = c.id
      LEFT JOIN product p ON p.id = cp.product_id AND p.deleted_at IS NULL AND p.status = 'published'
        AND EXISTS (SELECT 1 FROM product_sales_channel sc WHERE sc.product_id = p.id
          AND sc.deleted_at IS NULL AND sc.sales_channel_id = ANY(?::text[]))
      WHERE c.deleted_at IS NULL AND c.is_active AND NOT c.is_internal
      GROUP BY c.id ORDER BY c.rank, c.name`,
      [req.publishable_key_context.sales_channel_ids],
    ),
    russianRegion(req.scope.resolve(Modules.REGION)),
  ])
  const saved = (store?.metadata?.nord || {}) as Partial<StorefrontConfig>
  const region = requireStoreRegion(candidate, saved.regionId)
  return {
    categories: rows.map(({ count: _, ...category }) => category),
    categoryCounts: Object.fromEntries(
      rows.map((category) => [category.id, Number(category.count)]),
    ),
    scenes: Array.isArray(saved.scenes) ? saved.scenes : [],
    accentProduct: saved.accentProduct || '',
    regionId: region.id,
    returnDays: Number(saved.returnDays) || 0,
    freeShippingFrom: await freeShippingThreshold(req, region.id),
    showroom: saved.showroom || { city: '', address: '', postalCode: '', hours: '' },
    cities: Array.isArray(saved.cities) ? saved.cities : [],
  }
}
