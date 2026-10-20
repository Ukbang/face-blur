import type { Detection, Rect } from './types'

export function area(r: Rect): number {
  return Math.max(0, r.width) * Math.max(0, r.height)
}

export function intersection(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * 교집합 / 작은 박스 면적.
 * 타일 경계에서 잘린 박스가 온전한 박스 안에 들어가는 경우도 중복으로 잡기 위해 IoU 대신 쓴다.
 */
export function overlapOverMin(a: Rect, b: Rect): number {
  const minArea = Math.min(area(a), area(b))
  return minArea > 0 ? intersection(a, b) / minArea : 0
}

/** 점수 높은 순으로 남기고, 이미 남긴 박스와 많이 겹치는 박스는 버린다. */
export function nonMaxSuppression(detections: Detection[], threshold = 0.5): Detection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score)
  const kept: Detection[] = []
  for (const d of sorted) {
    if (kept.every((k) => overlapOverMin(k, d) < threshold)) kept.push(d)
  }
  return kept
}
