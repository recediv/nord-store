import { Input, Label, Text } from '@medusajs/ui'
import { useId, useState } from 'react'
import { uploadImage } from '../lib/client'

export function ImageField({
  label,
  value,
  onChange,
  onUploadingChange,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onUploadingChange?: (uploading: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled || pending}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ссылка на изображение"
      />
      <input
        type="file"
        aria-label={`Загрузить: ${label}`}
        accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={disabled || pending}
        onChange={async (event) => {
          const input = event.currentTarget
          const file = input.files?.[0]
          if (!file) return
          setPending(true)
          onUploadingChange?.(true)
          setError('')
          try {
            onChange(await uploadImage(file))
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Ошибка загрузки.')
          } finally {
            input.value = ''
            setPending(false)
            onUploadingChange?.(false)
          }
        }}
      />
      {pending && (
        <Text size="small" role="status">
          Обрабатываем изображение…
        </Text>
      )}
      {error && (
        <Text size="small" className="text-ui-fg-error" role="alert">
          {error}
        </Text>
      )}
    </div>
  )
}
