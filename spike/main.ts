// 개발 전용 감지 실험 페이지. scripts/spike-run.mjs가 Playwright로 열어 window.runSpike를 호출한다.
import { createMediaPipeDetector, type MediaPipeModel } from '../src/lib/detector/mediapipe'
import { DEFAULT_TILING, detectWithTiling, type TilingOptions } from '../src/lib/detector/tiling'
import type { Detection } from '../src/lib/detector/types'

export interface SpikeConfig {
  name: string
  model: MediaPipeModel
  /** false면 이미지 전체 한 번만 감지 */
  tiling: false | Partial<TilingOptions>
  minConfidence: number
}

export interface SpikeImageResult {
  image: string
  width: number
  height: number
  ms: number
  detections: Detection[]
  /** 박스를 그린 축소 JPEG (data URL) */
  annotated?: string
}

async function loadImage(name: string): Promise<ImageBitmap> {
  const blob = await (await fetch(`/spike/images/${name}.jpg`)).blob()
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}

function annotate(img: ImageBitmap, detections: Detection[], maxSide = 1600): string {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  ctx.lineWidth = 2
  ctx.font = '12px sans-serif'
  for (const d of detections) {
    ctx.strokeStyle = '#00ff3c'
    ctx.strokeRect(d.x * scale, d.y * scale, d.width * scale, d.height * scale)
    ctx.fillStyle = '#00ff3c'
    ctx.fillText(d.score.toFixed(2), d.x * scale, d.y * scale - 2)
  }
  return canvas.toDataURL('image/jpeg', 0.85)
}

async function runSpike(images: string[], config: SpikeConfig, withAnnotation: boolean): Promise<SpikeImageResult[]> {
  const status = document.getElementById('status')!
  const detector = await createMediaPipeDetector({ model: config.model, minConfidence: config.minConfidence })
  const results: SpikeImageResult[] = []
  for (const name of images) {
    status.textContent = `${config.name}: ${name}`
    const img = await loadImage(name)
    const t0 = performance.now()
    const detections = config.tiling
      ? detectWithTiling(detector, img, { ...DEFAULT_TILING, ...config.tiling })
      : detector.detect(img)
    const ms = performance.now() - t0
    results.push({
      image: name,
      width: img.width,
      height: img.height,
      ms,
      detections,
      annotated: withAnnotation ? annotate(img, detections) : undefined,
    })
    img.close()
  }
  detector.close()
  status.textContent = '완료'
  return results
}

declare global {
  interface Window {
    runSpike: typeof runSpike
  }
}
window.runSpike = runSpike
document.getElementById('status')!.textContent = 'ready'
