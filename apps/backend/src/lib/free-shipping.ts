import type { MedusaStoreRequest } from '@medusajs/framework/http'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

export async function freeShippingThreshold(req: MedusaStoreRequest, regionId: string) {
  const channelIds = req.publishable_key_context.sales_channel_ids
  // Without a cart, multiple channels are ambiguous.
  if (channelIds.length !== 1) return null
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: channels } = await query.graph({
    entity: 'sales_channels',
    fields: [
      'id',
      'is_disabled',
      'stock_locations.fulfillment_sets.id',
      'stock_locations.fulfillment_providers.id',
      'stock_locations.fulfillment_providers.is_enabled',
    ],
    filters: { id: channelIds },
  })
  const providersBySet = new Map<string, Set<string>>()
  for (const channel of channels) {
    if (channel.is_disabled) continue
    for (const location of channel.stock_locations || []) {
      if (!location) continue
      const providers = (location.fulfillment_providers || []).flatMap((provider) =>
        provider?.is_enabled ? [provider.id] : [],
      )
      for (const set of location.fulfillment_sets || []) {
        if (!set) continue
        const ids = providersBySet.get(set.id) || new Set<string>()
        for (const providerId of providers) ids.add(providerId)
        if (ids.size) providersBySet.set(set.id, ids)
      }
    }
  }
  if (!providersBySet.size) return null
  const fulfillment = req.scope.resolve(Modules.FULFILLMENT)
  const options = await fulfillment.listShippingOptionsForContext({
    fulfillment_set_id: [...providersBySet.keys()],
    fulfillment_set_type: 'shipping',
    address: { country_code: 'ru' },
    price_type: 'flat',
    context: {
      enabled_in_store: 'true',
      is_return: 'false',
      region_id: regionId,
      currency_code: 'rub',
    },
  })
  const knownRules = new Set(['enabled_in_store', 'is_return', 'region_id', 'currency_code'])
  const ids = options
    .filter(
      (option) =>
        option.type?.code === 'standard' &&
        providersBySet.get(option.service_zone.fulfillment_set_id)?.has(option.provider_id) &&
        option.rules.every((rule) => knownRules.has(rule.attribute)),
    )
    .map((option) => option.id)
  if (!ids.length) return null
  // Include only permanent flat prices with a simple subtotal threshold.
  // Native checkout validates eligibility and calculates the final quote.
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { rows } = await db.raw<{ rows: { minimum: string | null }[] }>(
    `
    SELECT min(r.value::numeric) AS minimum
    FROM shipping_option_price_set ps
    JOIN price p ON p.price_set_id = ps.price_set_id AND p.deleted_at IS NULL
    JOIN price_rule r ON r.price_id = p.id AND r.deleted_at IS NULL
      AND r.attribute = 'item_total' AND r.operator = 'gte'
      AND r.value ~ '^[0-9]+([.][0-9]+){0,1}$'
    WHERE ps.deleted_at IS NULL AND ps.shipping_option_id = ANY(?::text[])
      AND p.amount = 0 AND p.currency_code = 'rub' AND p.price_list_id IS NULL
      AND p.min_quantity IS NULL AND p.max_quantity IS NULL
      AND (SELECT count(*) FROM price_rule x WHERE x.price_id = p.id
        AND x.deleted_at IS NULL AND x.attribute = 'item_total') = 1
      AND NOT EXISTS (SELECT 1 FROM price_rule x WHERE x.price_id = p.id AND x.deleted_at IS NULL
        AND NOT coalesce((x.attribute = 'item_total' AND x.operator = 'gte')
          OR (x.attribute = 'region_id' AND x.operator = 'eq' AND x.value = ?), false))
  `,
    [ids, regionId],
  )
  const minimum = Number(rows[0]?.minimum)
  return rows[0]?.minimum != null && Number.isFinite(minimum) && minimum > 0 ? minimum : null
}
