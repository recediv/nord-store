import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import type { IRegionModuleService, IStoreModuleService } from '@medusajs/framework/types'
import {
  ContainerRegistrationKeys,
  isValidHandle,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'
import { updateStoresWorkflow } from '@medusajs/medusa/core-flows'
import { z } from '@medusajs/framework/zod'
import { requireStoreRegion, russianRegion } from '../../../../lib/store-region'

const schema = z.object({
  scenes: z
    .array(
      z.object({
        handle: z.string().trim().refine(isValidHandle),
        image: z.string().trim().min(1).max(2048),
        bg: z.string().regex(/^#[\da-f]{6}$/i),
        ink: z.string().regex(/^#[\da-f]{6}$/i),
        muted: z.string().regex(/^#[\da-f]{6}$/i),
        cutout: z.boolean(),
      }),
    )
    .max(6),
  accentProduct: z
    .string()
    .trim()
    .refine((handle) => !handle || isValidHandle(handle)),
  regionId: z.string().trim().min(1).max(100),
  returnDays: z.number().int().min(1).max(365),
  showroom: z.object({
    city: z.string().trim().min(1).max(100),
    address: z.string().trim().min(1).max(250),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
    hours: z.string().trim().max(100),
  }),
  cities: z
    .array(z.string().trim().min(1).max(100))
    .max(100)
    .transform((cities) => {
      const seen = new Set<string>()
      return cities.filter((city) => {
        const key = city.toLocaleLowerCase('ru')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    })
    .optional(),
})
function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [[store], region] = await Promise.all([
    req.scope.resolve<IStoreModuleService>(Modules.STORE).listStores({}, { take: 1 }),
    russianRegion(req.scope.resolve<IRegionModuleService>(Modules.REGION)),
  ])
  if (!store) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Магазин не найден.')
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    config: metadata(store.metadata?.nord),
    regions: region?.currency_code === 'rub' ? [region] : [],
  })
}
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Проверьте товары, цвета, регион, города, адрес и срок возврата.',
    )
  const handles = [
    ...new Set(
      [...parsed.data.scenes.map((scene) => scene.handle), parsed.data.accentProduct].filter(
        Boolean,
      ),
    ),
  ]
  if (new Set(parsed.data.scenes.map((scene) => scene.handle)).size !== parsed.data.scenes.length)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Товар в слайдере может встречаться только один раз.',
    )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: products }, region] = await Promise.all([
    handles.length
      ? query.graph({ entity: 'product', fields: ['handle'], filters: { handle: handles } })
      : Promise.resolve({ data: [] as { handle: string }[] }),
    russianRegion(req.scope.resolve<IRegionModuleService>(Modules.REGION)),
  ])
  requireStoreRegion(region, parsed.data.regionId)
  const missing = handles.filter((handle) => !products.some((product) => product.handle === handle))
  if (missing.length)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Товары не найдены: ${missing.join(', ')}.`,
    )
  const stores = req.scope.resolve<IStoreModuleService>(Modules.STORE)
  const [store] = await stores.listStores({}, { take: 1 })
  if (!store) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Магазин не найден.')
  const current = metadata(store.metadata?.nord)
  const config = {
    ...current,
    ...parsed.data,
    showroom: { ...metadata(current.showroom), ...parsed.data.showroom },
  }
  await updateStoresWorkflow(req.scope).run({
    input: { selector: { id: store.id }, update: { metadata: { nord: config } } },
  })
  res.json({ config })
}
