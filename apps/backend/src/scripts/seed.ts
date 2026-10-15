import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ExecArgs } from '@medusajs/framework/types'
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from '@medusajs/framework/utils'
import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createPromotionsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
  updateProductCategoriesWorkflow,
  updateProductVariantsWorkflow,
  uploadFilesWorkflow,
} from '@medusajs/medusa/core-flows'
import catalog from '../data/catalog.json'
import { russianRegion } from '../lib/store-region'

const setCurrency = createWorkflow('nord-set-store-currency', (input: { store_id: string }) => {
  const update = transform(input, (data) => ({
    selector: { id: data.store_id },
    update: { supported_currencies: [{ currency_code: 'rub', is_default: true }] },
  }))
  return new WorkflowResponse(updateStoresStep(update))
})

const demoSku = (handle: string, index: number) => `NORD-${handle.toUpperCase()}-${index + 1}`

/** Add missing demo records without resetting inventory or orders. */
export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const stores = container.resolve(Modules.STORE)
  const sales = container.resolve(Modules.SALES_CHANNEL)
  const regions = container.resolve(Modules.REGION)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const locations = container.resolve(Modules.STOCK_LOCATION)
  const productService = container.resolve(Modules.PRODUCT)
  const inventory = container.resolve(Modules.INVENTORY)
  const promotion = container.resolve(Modules.PROMOTION)
  const pricing = container.resolve(Modules.PRICING)

  logger.info('Preparing NORD demo store...')
  const [store] = await stores.listStores()
  const [[namedRegion], candidate] = await Promise.all([
    regions.listRegions({ name: 'NORD Russia' }, { take: 1, relations: ['countries'] }),
    russianRegion(regions),
  ])
  if (
    (namedRegion &&
      (namedRegion.currency_code !== 'rub' ||
        !namedRegion.countries.some((country) => country.iso_2 === 'ru'))) ||
    (candidate && candidate.currency_code !== 'rub')
  )
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Регион России или NORD Russia настроен несовместимо: нужны страна Россия и валюта RUB. Seed не изменяет существующие регионы; исправьте настройки Medusa.',
    )
  let region = candidate
  let [channel] = await sales.listSalesChannels({ name: 'NORD Storefront' })
  if (!channel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: 'NORD Storefront' }] },
    })
    channel = result[0]
  }
  await setCurrency(container).run({ input: { store_id: store.id } })
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { name: 'NORD', default_sales_channel_id: channel.id },
    },
  })

  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: 'NORD Russia',
            currency_code: 'rub',
            countries: ['ru'],
            automatic_taxes: false,
            payment_providers: ['pp_system_default'],
          },
        ],
      },
    })
    region = result[0]
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: 'ru', provider_id: 'tp_system' }],
    })
  }

  let [location] = await locations.listStockLocations({ name: 'NORD Demo Warehouse' })
  if (!location) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: 'NORD Demo Warehouse',
            address: { address_1: 'Ленина, 12 (демо)', city: 'Новосибирск', country_code: 'ru' },
          },
        ],
      },
    })
    location = result[0]
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: 'manual_manual' },
    })
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: [channel.id] },
    })
  }
  await updateStoresWorkflow(container).run({
    input: { selector: { id: store.id }, update: { default_location_id: location.id } },
  })
  if (!store.metadata?.nord)
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          metadata: { nord: { ...catalog.storefront, regionId: region.id } },
        },
      },
    })
  else if (!Array.isArray((store.metadata.nord as { cities?: unknown }).cities))
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          metadata: {
            nord: {
              ...(store.metadata.nord as Record<string, unknown>),
              cities: catalog.storefront.cities,
            },
          },
        },
      },
    })

  let [profile] = await fulfillment.listShippingProfiles({ type: 'default' })
  if (!profile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: 'NORD Shipping', type: 'default' }] },
    })
    profile = result[0]
  }
  let [set] = await fulfillment.listFulfillmentSets(
    { name: 'NORD Demo Delivery' },
    { relations: ['service_zones'] },
  )
  if (!set) {
    set = await fulfillment.createFulfillmentSets({
      name: 'NORD Demo Delivery',
      type: 'shipping',
      service_zones: [{ name: 'Russia', geo_zones: [{ type: 'country', country_code: 'ru' }] }],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    })
  }
  const shipping = await fulfillment.listShippingOptions(
    { service_zone: { id: set.service_zones[0].id } },
    { relations: ['type'] },
  )
  const shippingDefinitions = [
    {
      code: 'standard',
      name: 'Стандартная доставка',
      description: '3–5 дней. Бесплатно от 15 000 ₽ после скидок.',
      amount: 490,
    },
    { code: 'express', name: 'Экспресс-доставка', description: '1–2 рабочих дня.', amount: 990 },
    {
      code: 'pickup',
      name: 'Самовывоз из шоурума',
      description: 'Новосибирск, Ленина, 12. Демо.',
      amount: 0,
    },
  ]
  for (const option of shippingDefinitions) {
    if (shipping.some((s) => s.type?.code === option.code)) continue
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: option.name,
          price_type: 'flat',
          provider_id: 'manual_manual',
          service_zone_id: set.service_zones[0].id,
          shipping_profile_id: profile.id,
          type: { label: option.name, description: option.description, code: option.code },
          prices: [
            { currency_code: 'rub', amount: option.amount },
            ...(option.code === 'standard'
              ? [
                  {
                    currency_code: 'rub',
                    amount: 0,
                    rules: [{ attribute: 'item_total', operator: 'gte' as const, value: 15000 }],
                  },
                ]
              : []),
          ],
          rules: [
            { attribute: 'enabled_in_store', operator: 'eq', value: 'true' },
            { attribute: 'is_return', operator: 'eq', value: 'false' },
          ],
        },
      ],
    })
  }

  const { data: keys } = await query.graph({
    entity: 'api_key',
    fields: ['id', 'token', 'sales_channels.id'],
    filters: { type: 'publishable', title: 'NORD Storefront' },
  })
  let apiKey: { id: string; token?: string; sales_channels?: ({ id: string } | null)[] | null } =
    keys[0]
  if (!apiKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: 'NORD Storefront', type: 'publishable', created_by: '' }] },
    })
    apiKey = result[0]
  }
  if (!apiKey.sales_channels?.some((c) => c?.id === channel.id))
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: apiKey.id, add: [channel.id] },
    })

  const categoriesQuery = await query.graph({
    entity: 'product_category',
    fields: ['id', 'handle', 'metadata'],
    filters: { handle: catalog.categories.map((category) => category.id) },
    pagination: { take: catalog.categories.length },
  })
  const existingCategories: {
    id: string
    handle: string
    metadata?: Record<string, unknown> | null
  }[] = categoriesQuery.data
  const missingCategories = catalog.categories.filter(
    (c) => !existingCategories.some((existing) => existing.handle === c.id),
  )
  if (missingCategories.length) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingCategories.map((c) => ({
          name: c.name,
          handle: c.id,
          description: c.description,
          is_active: true,
          is_internal: false,
          metadata: { image: c.image },
        })),
      },
    })
    existingCategories.push(...result)
  }
  for (const category of existingCategories) {
    const demo = catalog.categories.find((c) => c.id === category.handle)
    if (demo && !category.metadata?.image)
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: category.id }, update: { metadata: { image: demo.image } } },
      })
  }
  const { data: existingProducts } = await query.graph({
    entity: 'product',
    fields: ['id', 'handle', 'metadata'],
    filters: { handle: catalog.products.map((p) => p.handle) },
    pagination: { take: 100 },
  })
  const missingProducts = catalog.products.filter(
    (p) => !existingProducts.some((existing) => existing.handle === p.handle),
  )
  const imageBase = (process.env.STOREFRONT_URL || 'http://localhost:5180').replace(/\/$/, '')
  if (missingProducts.length)
    await createProductsWorkflow(container).run({
      input: {
        products: missingProducts.map((p) => ({
          title: p.name,
          handle: p.handle,
          subtitle: p.subtitle,
          description: p.description,
          status: ProductStatus.PUBLISHED,
          category_ids: [existingCategories.find((c) => c.handle === p.category)!.id],
          shipping_profile_id: profile.id,
          thumbnail: `${imageBase}/images/${p.image}`,
          images: [{ url: `${imageBase}/images/${p.image}` }],
          metadata: { ...p, demo: true },
          options: [{ title: 'Цвет', values: p.colors.map((c) => c.name) }],
          variants: p.colors.map((color, index) => ({
            title: color.name,
            sku: demoSku(p.handle, index),
            manage_inventory: true,
            allow_backorder: false,
            options: { Цвет: color.name },
            prices: [{ currency_code: 'rub', amount: p.comparePrice || p.price }],
          })),
          sales_channels: [{ id: channel.id }],
        })),
      },
    })

  for (const product of existingProducts) {
    const demo = catalog.products.find((p) => p.handle === product.handle)
    if (demo && product.metadata?.demo && !Array.isArray(product.metadata.reviewEntries))
      await productService.updateProducts(product.id, {
        metadata: { reviewEntries: demo.reviewEntries },
      })
  }
  const saleTitle = 'NORD демо-скидки'
  const existingSale = (await pricing.listPriceLists({ q: saleTitle }, { take: 100 })).find(
    (list) => list.title === saleTitle,
  )
  const saleHandles = catalog.products
    .filter((product) => product.comparePrice)
    .map((product) => product.handle)
  const { data: saleProducts } = await query.graph({
    entity: 'product',
    fields: [
      'id',
      'handle',
      'metadata',
      'variants.id',
      'variants.price_set.id',
      'variants.price_set.prices.*',
    ],
    filters: { handle: saleHandles },
    pagination: { take: saleHandles.length },
  })
  const salePrices: { price_set_id: string; amount: number; currency_code: string }[] = []
  const scheduledPriceSets = new Set<string>()
  const basePrices: { id: string; prices: { currency_code: string; amount: number }[] }[] = []
  for (const product of saleProducts) {
    const demo = catalog.products.find((p) => p.handle === product.handle)
    if (!demo?.comparePrice || !product.metadata?.demo) continue
    for (const variant of product.variants || []) {
      const priceSet = variant.price_set
      // Preserve existing price-list entries.
      if (
        !priceSet ||
        scheduledPriceSets.has(priceSet.id) ||
        (existingSale && priceSet.prices?.some((price) => price?.price_list_id === existingSale.id))
      )
        continue
      const original = priceSet.prices?.flatMap((price) =>
        price && !price.price_list_id ? [price] : [],
      )
      // Preserve custom prices and rules.
      if (
        original?.length !== 1 ||
        original[0].currency_code !== 'rub' ||
        original[0].rules_count ||
        original[0].min_quantity != null ||
        original[0].max_quantity != null ||
        ![demo.price, demo.comparePrice].includes(Number(original[0].amount))
      )
        continue
      if (!existingSale && Number(original[0].amount) === demo.price)
        basePrices.push({
          id: variant.id,
          prices: [{ currency_code: 'rub', amount: demo.comparePrice }],
        })
      salePrices.push({
        price_set_id: priceSet.id,
        currency_code: 'rub',
        amount: demo.price,
      })
      scheduledPriceSets.add(priceSet.id)
    }
  }
  if (basePrices.length)
    await updateProductVariantsWorkflow(container).run({
      input: { product_variants: basePrices },
    })
  if (salePrices.length && existingSale)
    await pricing.addPriceListPrices([{ price_list_id: existingSale.id, prices: salePrices }])
  else if (salePrices.length)
    await pricing.createPriceLists([
      {
        title: saleTitle,
        description: 'Демонстрационные специальные цены витрины NORD',
        type: 'sale',
        status: 'active',
        prices: salePrices,
      },
    ])
  const { data: imageProducts } = await query.graph({
    entity: 'product',
    fields: ['id', 'handle', 'thumbnail', 'metadata', 'images.url'],
    filters: { handle: catalog.products.map((product) => product.handle) },
    pagination: { take: 100 },
  })
  for (const product of imageProducts) {
    const demo = catalog.products.find((item) => item.handle === product.handle)
    if (
      !demo ||
      !product.metadata?.demo ||
      !product.thumbnail ||
      !/^http:\/\/(localhost|127\.0\.0\.1):5180\/images\//.test(product.thumbnail) ||
      !product.thumbnail.endsWith('/' + demo.image) ||
      (product.images?.length || 0) > 1
    )
      continue
    const buffer = readFileSync(resolve(process.cwd(), 'src/data/images', demo.image))
    const { result } = await uploadFilesWorkflow(container).run({
      input: {
        files: [
          {
            filename: demo.image,
            mimeType: 'image/jpeg',
            content: buffer.toString('binary'),
            access: 'public',
          },
        ],
      },
    })
    await productService.updateProducts(product.id, {
      thumbnail: result[0].url,
      images: [{ url: result[0].url }],
    })
  }

  const demoStockBySku = new Map(
    catalog.products.flatMap((product) =>
      product.colors.map((_, index) => [demoSku(product.handle, index), product.stock] as const),
    ),
  )
  const { data: inventoryItems } = await query.graph({
    entity: 'inventory_item',
    fields: ['id', 'sku'],
    filters: { sku: [...demoStockBySku.keys()] },
    pagination: { take: demoStockBySku.size },
  })
  const levels = inventoryItems.length
    ? await inventory.listInventoryLevels(
        { location_id: location.id, inventory_item_id: inventoryItems.map((item) => item.id) },
        { take: inventoryItems.length },
      )
    : []
  const stockedItems = new Set(levels.map((level) => level.inventory_item_id))
  const missingLevels = inventoryItems.flatMap((item) => {
    const stock = item.sku ? demoStockBySku.get(item.sku) : undefined
    if (stock == null || stockedItems.has(item.id)) return []
    return [
      {
        inventory_item_id: item.id,
        location_id: location.id,
        stocked_quantity: stock,
      },
    ]
  })
  if (missingLevels.length)
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: missingLevels },
    })
  const [existingPromo] = await promotion.listPromotions({ code: 'NORD10' })
  if (!existingPromo)
    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code: 'NORD10',
            type: 'standard',
            status: 'active',
            is_automatic: false,
            application_method: {
              type: 'percentage',
              target_type: 'items',
              allocation: 'across',
              value: 10,
              currency_code: 'rub',
            },
          },
        ],
      },
    })

  const runtime = resolve(process.cwd(), '../../.runtime')
  mkdirSync(runtime, { recursive: true })
  writeFileSync(
    resolve(runtime, 'store-config.json'),
    JSON.stringify({ regionId: region.id, publishableKey: apiKey.token }, null, 2),
  )
  logger.info(
    `NORD ready: ${catalog.products.length} products, RUB, 3 delivery methods, NORD10 promotion. Store config: .runtime/store-config.json`,
  )
}
