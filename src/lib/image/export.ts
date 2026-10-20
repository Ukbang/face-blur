import { renderScene, type EffectOptions } from '../effects/render'
import type { Face } from '../faces'
import type { LoadedImage, SupportedType } from './load'

const EXT: Record<SupportedType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** 원본 해상도로 효과를 적용해 원래 형식의 Blob으로 만든다. 캔버스로 다시 인코딩하므로 EXIF는 남지 않는다. */
export async function exportImage(image: LoadedImage, faces: Face[], opts: EffectOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')!
  renderScene(ctx, image.canvas, image.width, image.height, faces, opts)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, image.type, 0.92))
  // 메모리 해제 (iOS는 캔버스 메모리 한도가 빡빡하다)
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('이미지를 저장하지 못했습니다.')
  return blob
}

export function exportFileName(image: LoadedImage): string {
  return `${image.baseName}-blurred.${EXT[image.type]}`
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
