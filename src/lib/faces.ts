import { overlapOverMin } from './detector/nms'
import type { Detection, Rect } from './detector/types'

/** 편집 화면에서 다루는 얼굴 영역. 좌표는 원본 이미지 픽셀 기준. */
export interface Face extends Rect {
  id: string
  /** false면 블러를 적용하지 않는다 (오탐 해제) */
  enabled: boolean
  source: 'auto' | 'manual'
}

let seq = 0
export const newFaceId = () => `f${++seq}`

/**
 * 감지 박스는 눈~턱 위주라 머리카락, 이마, 귀가 남는다. 여유를 두고 넓힌다.
 * 비율은 박스 크기 기준: 좌우 각 20%, 위 35%, 아래 15%.
 */
export function expandFaceBox(d: Rect, imageW: number, imageH: number): Rect {
  const x0 = Math.max(0, d.x - d.width * 0.2)
  const y0 = Math.max(0, d.y - d.height * 0.35)
  const x1 = Math.min(imageW, d.x + d.width * 1.2)
  const y1 = Math.min(imageH, d.y + d.height * 1.15)
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

export function detectionsToFaces(detections: Detection[], imageW: number, imageH: number): Face[] {
  return detections.map((d) => ({
    ...expandFaceBox(d, imageW, imageH),
    id: newFaceId(),
    enabled: true,
    source: 'auto',
  }))
}

/**
 * 정밀 감지 결과 중 기존 영역과 겹치지 않는 것만 새 얼굴로 돌려준다.
 * 사용자가 해제한(enabled=false) 영역과 겹치는 것도 다시 추가하지 않는다.
 */
export function newFacesOnly(existing: Face[], found: Face[]): Face[] {
  return found.filter((f) => existing.every((e) => overlapOverMin(e, f) < 0.5))
}

/** 이미지 밖으로 나가지 않게 자르고 최소 크기를 보장한다. */
export function clampRect(r: Rect, imageW: number, imageH: number, minSize = 8): Rect {
  const width = Math.min(imageW, Math.max(minSize, r.width))
  const height = Math.min(imageH, Math.max(minSize, r.height))
  const x = Math.min(Math.max(0, r.x), imageW - width)
  const y = Math.min(Math.max(0, r.y), imageH - height)
  return { x, y, width, height }
}
