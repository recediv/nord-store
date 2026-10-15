import type { IRegionModuleService, RegionCountryDTO, RegionDTO } from '@medusajs/framework/types'
import { MedusaError } from '@medusajs/framework/utils'

type StoreRegion = Pick<RegionDTO, 'id' | 'name' | 'currency_code'>

export async function russianRegion(regions: IRegionModuleService) {
  // The service populates this relation, but RegionCountryDTO omits it.
  const [country] = await regions.listCountries({ iso_2: 'ru' }, { take: 1, relations: ['region'] })
  return (
    (country as (RegionCountryDTO & { region?: StoreRegion | null }) | undefined)?.region ||
    undefined
  )
}

export function requireStoreRegion(region: StoreRegion | undefined, configuredId?: unknown) {
  if (
    !region ||
    region.currency_code !== 'rub' ||
    (configuredId != null && configuredId !== '' && configuredId !== region.id)
  )
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Регион витрины недоступен. Выберите регион со страной Россия и валютой RUB в настройках витрины NORD.',
    )
  return region
}
