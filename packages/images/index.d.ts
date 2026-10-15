export type ImageVariants = {
  width: number
  height: number
  variants: { width: number; height: number; webp: Buffer; avif: Buffer }[]
}
export function createImageVariants(
  buffer: Buffer,
  options?: { maxWidth?: number; maxHeight?: number; widths?: number[] },
): Promise<ImageVariants | null>
