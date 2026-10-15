import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import type { MedusaStoreRequest } from '@medusajs/framework/http'
import type { MedusaPricingContext, PricingContext } from '@medusajs/framework/types'
import { requireStoreRegion, russianRegion } from './store-region'

// Use native cart pricing for catalog facets and sorting.
export async function catalogPrices(req: MedusaStoreRequest, handles?: string[]) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const pricing = req.scope.resolve(Modules.PRICING)
  const regions = req.scope.resolve(Modules.REGION)
  const stores = req.scope.resolve(Modules.STORE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customerId = req.auth_context?.actor_id
  const values = [req.publishable_key_context.sales_channel_ids]
  let restriction = ''
  if (handles) {
    restriction = 'AND p.handle = ANY(?::text[])'
    values.push(handles)
  }
  const [{ rows }, [store], candidate, customers] = await Promise.all([
    db.raw<{ rows: { id: string }[] }>(
      `SELECT DISTINCT ps.price_set_id AS id FROM product p
      JOIN product_variant v ON v.product_id = p.id AND v.deleted_at IS NULL
      JOIN product_variant_price_set ps ON ps.variant_id = v.id AND ps.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'published'
        AND EXISTS (SELECT 1 FROM product_sales_channel sc WHERE sc.product_id = p.id
          AND sc.deleted_at IS NULL AND sc.sales_channel_id = ANY(?::text[])) ${restriction}`,
      values,
    ),
    stores.listStores({}, { take: 1, select: ['metadata'] }),
    russianRegion(regions),
    customerId
      ? query.graph({
          entity: 'customer',
          fields: ['id', 'groups.id'],
          filters: { id: customerId },
        })
      : Promise.resolve({ data: [] }),
  ])
  const saved = store?.metadata?.nord as { regionId?: unknown } | undefined
  const region = requireStoreRegion(candidate, saved?.regionId)
  const customer = customers.data[0]
  const context: MedusaPricingContext & { quantity: number } = {
    currency_code: region.currency_code,
    quantity: 1,
    region_id: region.id,
    ...(customer
      ? {
          customer_id: customer.id,
          customer: {
            groups: (customer.groups || []).flatMap((group) => (group ? [{ id: group.id }] : [])),
          },
        }
      : {}),
  }
  const result: { id: string; amount: number; original: number | null }[] = []
  for (let offset = 0; offset < rows.length; offset += 250) {
    const prices = await pricing.calculatePrices(
      { id: rows.slice(offset, offset + 250).map((row) => row.id) },
      // Medusa 2.18 supports nested groups despite its scalar-only input type.
      { context: context as unknown as PricingContext['context'] },
    )
    for (const price of prices) {
      if (price.calculated_amount == null) continue
      const amount = Number(price.calculated_amount)
      const original = price.original_amount == null ? null : Number(price.original_amount)
      result.push({
        id: price.id,
        amount,
        original: original != null && original > amount ? original : null,
      })
    }
  }
  return result
}
