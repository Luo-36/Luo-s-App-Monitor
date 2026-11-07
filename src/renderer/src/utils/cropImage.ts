import type { CropData } from '@/types'

/**
 * Crops a data-URL / file-URL image using the crop rectangle reported by
 * react-easy-crop (coordinates are in natural image pixels) and returns a
 * PNG data URL of the cropped region.
 */
export async function cropImageToDataUrl(imageSrc: string, cropData: CropData): Promise<string> {
  const image = new Image()
  image.src = imageSrc

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Failed to load image for cropping'))
  })

  const width = Math.max(1, Math.round(cropData.width))
  const height = Math.max(1, Math.round(cropData.height))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  ctx.drawImage(
    image,
    cropData.x,
    cropData.y,
    cropData.width,
    cropData.height, // source rectangle (natural pixels)
    0,
    0,
    width,
    height // destination rectangle
  )

  return canvas.toDataURL('image/png')
}
