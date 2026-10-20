export const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type SupportedType = (typeof SUPPORTED_TYPES)[number]

/**
 * 캔버스 한 장의 최대 픽셀 수. iOS Safari의 캔버스 메모리 한도(약 16.7MP)에 맞춘다.
 * 12MP 폰 사진(4032×3024)은 그대로, 48MP 사진은 이 크기로 줄인다.
 */
export const MAX_PIXELS = 16_777_216

export interface LoadedImage {
  /** 회전 보정과 크기 제한을 적용한 원본. 감지와 저장은 모두 이 캔버스 기준이다. */
  canvas: HTMLCanvasElement
  width: number
  height: number
  type: SupportedType
  /** 확장자를 뺀 원래 파일 이름 */
  baseName: string
  /** MAX_PIXELS를 넘어서 줄였으면 원래 크기 */
  downscaledFrom?: { width: number; height: number }
}

export class ImageLoadError extends Error {}

export function isSupported(type: string): type is SupportedType {
  return (SUPPORTED_TYPES as readonly string[]).includes(type)
}

/** 원래 크기에서 MAX_PIXELS 안에 들어가는 크기 (비율 유지) */
export function fitWithinPixels(width: number, height: number, maxPixels = MAX_PIXELS): { width: number; height: number } {
  if (width * height <= maxPixels) return { width, height }
  const scale = Math.sqrt(maxPixels / (width * height))
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) }
}

/**
 * 파일을 디코딩해 캔버스로 만든다.
 * <img>로 디코딩하면 모든 주요 브라우저가 EXIF 회전 정보를 반영하고,
 * 캔버스에 다시 그리면 EXIF(GPS 등) 메타데이터는 따라오지 않는다.
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!isSupported(file.type)) {
    throw new ImageLoadError('JPEG, PNG, WebP 사진만 지원합니다.')
  }

  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      throw new ImageLoadError('사진을 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.')
    }

    const natural = { width: img.naturalWidth, height: img.naturalHeight }
    const size = fitWithinPixels(natural.width, natural.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageLoadError('이 브라우저에서는 사진을 처리할 수 없습니다.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, size.width, size.height)

    return {
      canvas,
      width: size.width,
      height: size.height,
      type: file.type,
      baseName: file.name.replace(/\.[^.]+$/, '') || 'photo',
      downscaledFrom: size.width !== natural.width ? natural : undefined,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
