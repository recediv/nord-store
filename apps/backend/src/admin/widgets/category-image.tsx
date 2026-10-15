import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { Button, Container, Heading, Text } from '@medusajs/ui'
import type { AdminProductCategory, DetailWidgetProps } from '@medusajs/framework/types'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ImageField } from '../components/image-field'
import { adminRequest } from '../lib/client'

const CategoryImage = ({ data }: DetailWidgetProps<AdminProductCategory>) => {
  const [image, setImage] = useState(String(data.metadata?.image || ''))
  const [pending, setPending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const client = useQueryClient()
  useEffect(() => {
    setImage(String(data.metadata?.image || ''))
    setSaved(false)
  }, [data.id])
  return (
    <Container className="space-y-4">
      <Heading level="h2">Изображение категории</Heading>
      <ImageField
        label="Картинка в меню и на главной"
        value={image}
        disabled={pending}
        onUploadingChange={(active) => {
          setUploading(active)
          if (active) setSaved(false)
        }}
        onChange={(next) => {
          setImage(next)
          setSaved(false)
        }}
      />
      {error && (
        <Text role="alert" className="text-ui-fg-error">
          {error}
        </Text>
      )}
      {saved && <Text role="status">Изображение сохранено.</Text>}
      <Button
        isLoading={pending}
        disabled={uploading}
        onClick={async () => {
          setPending(true)
          setError('')
          setSaved(false)
          try {
            await adminRequest(`/admin/product-categories/${data.id}`, { metadata: { image } })
            await client.invalidateQueries({ queryKey: ['categories'] })
            setSaved(true)
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Ошибка сохранения.')
          } finally {
            setPending(false)
          }
        }}
      >
        Сохранить изображение
      </Button>
    </Container>
  )
}
export const config = defineWidgetConfig({
  zone: 'product_category.details',
  id: 'nord-category-image',
})
export default CategoryImage
