import type { MedusaStoreRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils'
import { listShippingOptionsForCartWithPricingWorkflow } from '@medusajs/medusa/core-flows'

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const id = typeof req.query.cart_id === 'string' ? req.query.cart_id : ''
  if (!/^cart_[a-zA-Z0-9]+$/.test(id))
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Не выбрана корзина.')
  const carts = req.scope.resolve(Modules.CART)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cart = await carts.retrieveCart(id, { select: ['id', 'sales_channel_id', 'region_id'] })
  if (
    !cart.sales_channel_id ||
    !req.publishable_key_context.sales_channel_ids.includes(cart.sales_channel_id)
  )
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Корзина недоступна в этом магазине.')
  if (!cart.region_id)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Для корзины не выбран регион.')
  const [options, { data: regions }] = await Promise.all([
    listShippingOptionsForCartWithPricingWorkflow(req.scope).run({ input: { cart_id: id } }),
    query.graph({
      entity: 'region',
      fields: [
        'id',
        'currency_code',
        'countries.iso_2',
        'payment_providers.id',
        'payment_providers.is_enabled',
      ],
      filters: { id: cart.region_id },
    }),
  ])
  const region = regions[0]
  if (
    !region ||
    region.currency_code !== 'rub' ||
    !(region.countries || []).some((country) => country?.iso_2 === 'ru')
  )
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Для оформления нужен регион со страной Россия и валютой RUB. Обновите корзину.',
    )
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    shipping: options.result
      .filter((option) => option.amount != null)
      .map((option) => ({
        id: option.id,
        code: option.type?.code || option.id,
        name: option.name,
        description: option.type?.description || '',
        amount: Number(option.amount),
      })),
    payment: (region.payment_providers || []).flatMap((provider) =>
      provider?.is_enabled
        ? [
            {
              id: provider.id,
              name: provider.id === 'pp_system_default' ? 'Тестовая оплата' : provider.id,
            },
          ]
        : [],
    ),
  })
}
