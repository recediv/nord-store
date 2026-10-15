import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { Button, Container, Heading, Input, Label, Switch, Text, Textarea } from '@medusajs/ui'
import type { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { adminRequest } from '../lib/client'
import type { Review } from '../../catalog-contract'

function fields(product: AdminProduct) {
  const metadata = product.metadata || {}
  return {
    isNew: !!metadata.isNew,
    featured: !!metadata.featured,
    material: String(metadata.material || ''),
    room: String(metadata.room || ''),
    specs: Object.entries((metadata.specs || {}) as Record<string, string>)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n'),
    colors: ((metadata.colors || []) as { name: string; hex: string }[])
      .map((color) => `${color.name}: ${color.hex}`)
      .join('\n'),
    rating: Number(metadata.rating || 0),
    reviews: Number(metadata.reviews || 0),
    reviewEntries: (Array.isArray(metadata.reviewEntries)
      ? metadata.reviewEntries
      : []) as Review[],
  }
}
const ProductStorefront = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [value, setValue] = useState(() => fields(data))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const client = useQueryClient()
  const id = useId()
  useEffect(() => {
    setValue(fields(data))
    setMessage('')
    setError('')
  }, [data.id])
  const set = <K extends keyof typeof value>(key: K, next: (typeof value)[K]) => {
    setValue((previous) => ({ ...previous, [key]: next }))
    setMessage('')
  }
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Поля витрины NORD</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Новинки, рекомендации и характеристики. Скидки задаются в разделе ценовых списков, остатки
          — в складских запасах.
        </Text>
      </div>
      <form
        className="space-y-4 px-6 py-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setPending(true)
          setError('')
          setMessage('')
          try {
            const parse = (input: string) =>
              Object.fromEntries(
                input
                  .split('\n')
                  .filter((line) => line.trim())
                  .map((line) => {
                    const colon = line.indexOf(':')
                    if (colon < 1)
                      throw new Error(
                        'В каждой строке укажите название и значение через двоеточие.',
                      )
                    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()]
                  }),
              )
            const colors = Object.entries(parse(value.colors)).map(([name, hex]) => {
              if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('Цвет укажите в формате #aabbcc.')
              return { name, hex }
            })
            await adminRequest(`/admin/products/${data.id}`, {
              metadata: {
                isNew: value.isNew,
                featured: value.featured,
                material: value.material.trim(),
                room: value.room.trim(),
                specs: parse(value.specs),
                colors,
                rating: value.rating,
                reviews: value.reviews,
                reviewEntries: value.reviewEntries,
              },
            })
            await client.invalidateQueries({ queryKey: ['products'] })
            setMessage('Изменения сохранены.')
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Ошибка сохранения.')
          } finally {
            setPending(false)
          }
        }}
      >
        <div className="flex items-center gap-3">
          <Switch
            id={`${id}-new`}
            checked={value.isNew}
            onCheckedChange={(next) => set('isNew', next)}
          />
          <Label htmlFor={`${id}-new`}>Новинка</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id={`${id}-featured`}
            checked={value.featured}
            onCheckedChange={(next) => set('featured', next)}
          />
          <Label htmlFor={`${id}-featured`}>В подборке рекомендаций</Label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-material`}>Материал</Label>
            <Input
              id={`${id}-material`}
              value={value.material}
              onChange={(event) => set('material', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-room`}>Комната</Label>
            <Input
              id={`${id}-room`}
              value={value.room}
              onChange={(event) => set('room', event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-specs`}>Характеристики — одна в строке: название: значение</Label>
          <Textarea
            id={`${id}-specs`}
            rows={5}
            value={value.specs}
            onChange={(event) => set('specs', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-colors`}>Цвета вариантов — один в строке: название: #aabbcc</Label>
          <Textarea
            id={`${id}-colors`}
            rows={3}
            value={value.colors}
            onChange={(event) => set('colors', event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-rating`}>Демо-рейтинг</Label>
            <Input
              id={`${id}-rating`}
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={value.rating}
              onChange={(event) => set('rating', Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-reviews`}>Количество демо-оценок</Label>
            <Input
              id={`${id}-reviews`}
              type="number"
              min={0}
              step={1}
              value={value.reviews}
              onChange={(event) => set('reviews', Number(event.target.value))}
            />
          </div>
        </div>
        <Heading level="h3">Демо-отзывы</Heading>
        {value.reviewEntries.map((review, index) => (
          <div key={index} className="space-y-2 rounded border border-ui-border-base p-3">
            <Input
              aria-label="Автор отзыва"
              value={review.name}
              onChange={(event) =>
                set(
                  'reviewEntries',
                  value.reviewEntries.map((entry, position) =>
                    position === index ? { ...entry, name: event.target.value } : entry,
                  ),
                )
              }
            />
            <Input
              aria-label="Оценка отзыва"
              type="number"
              min={1}
              max={5}
              value={review.rating}
              onChange={(event) =>
                set(
                  'reviewEntries',
                  value.reviewEntries.map((entry, position) =>
                    position === index ? { ...entry, rating: Number(event.target.value) } : entry,
                  ),
                )
              }
            />
            <Textarea
              aria-label="Текст отзыва"
              value={review.text}
              onChange={(event) =>
                set(
                  'reviewEntries',
                  value.reviewEntries.map((entry, position) =>
                    position === index ? { ...entry, text: event.target.value } : entry,
                  ),
                )
              }
            />
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() =>
                set(
                  'reviewEntries',
                  value.reviewEntries.filter((_, position) => position !== index),
                )
              }
            >
              Удалить отзыв
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="small"
          type="button"
          onClick={() =>
            set('reviewEntries', [...value.reviewEntries, { name: '', rating: 5, text: '' }])
          }
        >
          Добавить отзыв
        </Button>
        {error && (
          <Text className="text-ui-fg-error" role="alert">
            {error}
          </Text>
        )}
        {message && <Text role="status">{message}</Text>}
        <div>
          <Button type="submit" isLoading={pending}>
            Сохранить поля витрины
          </Button>
        </div>
      </form>
    </Container>
  )
}
export const config = defineWidgetConfig({ zone: 'product.details', id: 'nord-product-storefront' })
export default ProductStorefront
