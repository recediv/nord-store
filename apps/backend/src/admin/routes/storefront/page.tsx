import { defineRouteConfig } from '@medusajs/admin-sdk'
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
} from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { ShowcaseScene, StorefrontConfig } from '../../../catalog-contract'
import { ImageField } from '../../components/image-field'
import { adminRequest } from '../../lib/client'

type Settings = Pick<
  StorefrontConfig,
  'scenes' | 'accentProduct' | 'regionId' | 'returnDays' | 'showroom'
> & { cities: string[] }
type Region = { id: string; name: string; currency_code: string }
function settings(initial: Partial<Settings>): Settings {
  return {
    scenes: initial.scenes || [],
    accentProduct: initial.accentProduct || '',
    regionId: initial.regionId || '',
    returnDays: initial.returnDays ?? 0,
    showroom: { city: '', address: '', postalCode: '', hours: '', ...initial.showroom },
    cities: initial.cities || [],
  }
}
function SettingsForm({ initial, regions }: { initial: Partial<Settings>; regions: Region[] }) {
  const [value, setValue] = useState(() => settings(initial))
  const [cities, setCities] = useState(() => (initial.cities || []).join('\n'))
  const [pending, setPending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const id = useId()
  const scene = (index: number, update: Partial<ShowcaseScene>) => {
    setValue((previous) => ({
      ...previous,
      scenes: previous.scenes.map((item, position) =>
        position === index ? { ...item, ...update } : item,
      ),
    }))
    setMessage('')
  }
  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setError('')
        setMessage('')
        try {
          const saved = await adminRequest<{ config: Settings }>('/admin/nord/storefront', {
            ...value,
            cities: cities
              .split(/\r?\n/)
              .map((city) => city.trim())
              .filter(Boolean),
          })
          setValue(settings(saved.config))
          setCities((saved.config.cities || []).join('\n'))
          setMessage('Настройки витрины сохранены.')
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Ошибка сохранения.')
        } finally {
          setPending(false)
        }
      }}
    >
      <fieldset disabled={pending || uploading} className="min-w-0 space-y-6">
        <Heading level="h2">Слайдер на главной</Heading>
        <Text className="text-ui-fg-subtle">
          Товар задаётся по его адресу (handle). Изображения обрабатываются при загрузке; для
          вырезанных предметов сохраните прозрачный фон.
        </Text>
        {value.scenes.map((item, index) => (
          <div key={index} className="space-y-3 rounded border border-ui-border-base p-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-handle-${index}`}>Товар {index + 1}</Label>
              <Input
                id={`${id}-handle-${index}`}
                required
                value={item.handle}
                onChange={(event) => scene(index, { handle: event.target.value })}
              />
            </div>
            <ImageField
              label={`Изображение предмета ${index + 1}`}
              value={item.image}
              onChange={(image) => scene(index, { image })}
              onUploadingChange={setUploading}
            />
            <div className="flex flex-wrap gap-6">
              {(
                [
                  ['bg', 'Фон'],
                  ['ink', 'Текст'],
                  ['muted', 'Вторичный текст'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  {label}
                  <input
                    type="color"
                    value={item[key]}
                    onChange={(event) => scene(index, { [key]: event.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id={`${id}-cutout-${index}`}
                checked={item.cutout}
                onCheckedChange={(cutout) => scene(index, { cutout })}
              />
              <Label htmlFor={`${id}-cutout-${index}`}>Вырезанный предмет на прозрачном фоне</Label>
            </div>
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() =>
                setValue((previous) => ({
                  ...previous,
                  scenes: previous.scenes.filter((_, position) => position !== index),
                }))
              }
            >
              Убрать из слайдера
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={value.scenes.length >= 6}
          onClick={() =>
            setValue((previous) => ({
              ...previous,
              scenes: [
                ...previous.scenes,
                {
                  handle: '',
                  image: '',
                  bg: '#214c38',
                  ink: '#fbfaf6',
                  muted: '#c9d7c0',
                  cutout: true,
                },
              ],
            }))
          }
        >
          Добавить предмет
        </Button>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-accent`}>Акцентный товар (handle)</Label>
            <Input
              id={`${id}-accent`}
              value={value.accentProduct}
              onChange={(event) =>
                setValue((previous) => ({ ...previous, accentProduct: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-returns`}>Дней на возврат</Label>
            <Input
              id={`${id}-returns`}
              type="number"
              min={1}
              max={365}
              required
              value={value.returnDays}
              onChange={(event) =>
                setValue((previous) => ({ ...previous, returnDays: Number(event.target.value) }))
              }
            />
          </div>
        </div>
        <Heading level="h2">Регион продаж</Heading>
        <div className="space-y-2">
          <Label htmlFor={`${id}-region`}>Регион каталога и новых корзин</Label>
          <Select
            required
            name="regionId"
            value={value.regionId}
            disabled={!regions.length}
            onValueChange={(regionId) => {
              setValue((previous) => ({ ...previous, regionId }))
              setMessage('')
            }}
          >
            <Select.Trigger id={`${id}-region`}>
              <Select.Value placeholder="Выберите регион" />
            </Select.Trigger>
            <Select.Content>
              {regions.map((region) => (
                <Select.Item key={region.id} value={region.id}>
                  {region.name} ({region.currency_code.toUpperCase()})
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Text size="small" className="text-ui-fg-subtle">
            Выберите регион со страной Россия и валютой RUB. Каталог и корзины используют этот
            регион.
          </Text>
          {!regions.length && (
            <Text role="alert" className="text-ui-fg-error">
              Сначала создайте регион со страной Россия и валютой RUB в настройках Medusa.
            </Text>
          )}
        </div>
        <Heading level="h2">Города</Heading>
        <div className="space-y-2">
          <Label htmlFor={`${id}-cities`}>
            Подсказки в выборе города — по одному городу в строке
          </Label>
          <Textarea
            id={`${id}-cities`}
            rows={6}
            maxLength={10100}
            value={cities}
            onChange={(event) => {
              setCities(event.target.value)
              setMessage('')
            }}
            aria-describedby={`${id}-cities-hint`}
          />
          <Text id={`${id}-cities-hint`} size="small" className="text-ui-fg-subtle">
            До 100 городов. Повторы и пустые строки убираются при сохранении. С пустым списком
            останутся ручной ввод и город шоурума. Способы доставки определяются настройками Medusa.
          </Text>
        </div>
        <Heading level="h2">Шоурум и самовывоз</Heading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(
            [
              ['city', 'Город'],
              ['address', 'Адрес'],
              ['postalCode', 'Индекс'],
              ['hours', 'Часы работы'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`${id}-${key}`}>{label}</Label>
              <Input
                id={`${id}-${key}`}
                required
                value={value.showroom[key]}
                onChange={(event) =>
                  setValue((previous) => ({
                    ...previous,
                    showroom: { ...previous.showroom, [key]: event.target.value },
                  }))
                }
              />
            </div>
          ))}
        </div>
        {error && (
          <Text role="alert" className="text-ui-fg-error">
            {error}
          </Text>
        )}
        {message && <Text role="status">{message}</Text>}
        <Button type="submit" isLoading={pending} disabled={!regions.length || uploading}>
          Сохранить настройки
        </Button>
      </fieldset>
    </form>
  )
}
const Storefront = () => {
  const { data, isPending, error } = useQuery({
    queryKey: ['nord-storefront'],
    queryFn: () =>
      adminRequest<{ config: Partial<Settings>; regions: Region[] }>('/admin/nord/storefront'),
  })
  return (
    <Container className="space-y-6">
      <Heading level="h1">Витрина NORD</Heading>
      {isPending ? (
        <Text role="status">Загружаем настройки…</Text>
      ) : error ? (
        <Text role="alert">{error.message}</Text>
      ) : (
        data && <SettingsForm initial={data.config} regions={data.regions} />
      )}
    </Container>
  )
}
export const config = defineRouteConfig({ label: 'Витрина NORD' })
export default Storefront
