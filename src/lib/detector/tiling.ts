import { nonMaxSuppression, overlapOverMin } from './nms'
import type { Detection, FaceDetector, Rect } from './types'

export interface TilingOptions {
  /** 이보다 작은 타일은 만들지 않는다 (px) */
  minTileSize: number
  /** 이웃 타일과 겹치는 비율 (0~1) */
  overlap: number
  /** NMS 임계값 (overlapOverMin 기준) */
  nmsThreshold: number
  /**
   * 후보 박스 주변을 잘라 한 번 더 감지해서 확인되는 것만 남긴다 (오탐 감소).
   * 0이면 끈다. 값은 재확인 때 요구하는 최소 점수.
   */
  verifyScore: number
}

export const DEFAULT_TILING: TilingOptions = {
  minTileSize: 480,
  overlap: 0.3,
  nmsThreshold: 0.5,
  verifyScore: 0,
}

/**
 * 이미지 크기에 맞춘 최소 타일 크기.
 * 감지 가능 여부는 얼굴의 절대 픽셀 크기로 정해진다. 그래서 작은 사진(메신저로 받아 줄어든 사진 등)일수록
 * 타일을 더 잘게 쪼갠다. 큰 사진은 긴 변/8(빠름)·/16(정밀)로 타일 개수를 제한한다.
 * 3840px 기준 빠름 480px·정밀 240px로, docs/SPIKE_RESULTS.md 실험값과 같다.
 */
export function minTileFor(longSide: number, precise: boolean): number {
  return precise ? Math.max(160, Math.round(longSide / 16)) : Math.max(240, Math.round(longSide / 8))
}

/** 한 변을 길이 size, 겹침 overlap으로 덮는 시작 좌표 목록. 마지막 타일은 끝에 맞춘다. */
export function tileStarts(length: number, size: number, overlap: number): number[] {
  if (size >= length) return [0]
  const step = Math.max(1, Math.floor(size * (1 - overlap)))
  const starts: number[] = []
  for (let s = 0; s + size < length; s += step) starts.push(s)
  starts.push(length - size)
  return starts
}

/**
 * 이미지 피라미드 타일 목록.
 * 레벨 0은 이미지 전체, 레벨이 올라갈 때마다 타일 한 변을 절반으로 줄인다.
 * 큰 얼굴은 낮은 레벨에서, 작은 얼굴은 높은 레벨의 작은 타일에서 잡힌다.
 */
export function buildTiles(width: number, height: number, opts: TilingOptions = DEFAULT_TILING): Rect[] {
  const tiles: Rect[] = [{ x: 0, y: 0, width, height }]
  let size = Math.floor(Math.max(width, height) / 2)
  while (size >= opts.minTileSize) {
    const w = Math.min(size, width)
    const h = Math.min(size, height)
    for (const y of tileStarts(height, h, opts.overlap)) {
      for (const x of tileStarts(width, w, opts.overlap)) {
        tiles.push({ x, y, width: w, height: h })
      }
    }
    size = Math.floor(size / 2)
  }
  return tiles
}

/** 박스가 이미지 테두리가 아닌 타일 내부 경계에 닿았는지 (= 잘렸을 가능성이 큰지) */
export function touchesInnerEdge(d: Rect, tile: Rect, imageW: number, imageH: number, margin = 2): boolean {
  const left = tile.x > 0 && d.x <= tile.x + margin
  const top = tile.y > 0 && d.y <= tile.y + margin
  const right = tile.x + tile.width < imageW && d.x + d.width >= tile.x + tile.width - margin
  const bottom = tile.y + tile.height < imageH && d.y + d.height >= tile.y + tile.height - margin
  return left || top || right || bottom
}

type CanvasLike = OffscreenCanvas | HTMLCanvasElement

function makeCanvas(w: number, h: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** 박스 중심 기준으로 한 변이 박스의 contextScale배인 정사각형 (이미지 밖은 잘라냄) */
export function contextCrop(d: Rect, imageW: number, imageH: number, contextScale = 3): Rect {
  const side = Math.max(d.width, d.height) * contextScale
  const cx = d.x + d.width / 2
  const cy = d.y + d.height / 2
  const x = Math.max(0, Math.round(cx - side / 2))
  const y = Math.max(0, Math.round(cy - side / 2))
  return {
    x,
    y,
    width: Math.min(imageW, Math.round(cx + side / 2)) - x,
    height: Math.min(imageH, Math.round(cy + side / 2)) - y,
  }
}

type ImageSource = ImageBitmap | HTMLCanvasElement | HTMLImageElement

function detectInRegion(detector: FaceDetector, image: ImageSource, region: Rect): Detection[] {
  const canvas = makeCanvas(region.width, region.height)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ctx.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height)
  return detector.detect(canvas).map((d) => ({ ...d, x: d.x + region.x, y: d.y + region.y }))
}

/** 피라미드 타일마다 감지를 돌리고 원본 좌표로 합친 뒤 중복을 제거한다. */
export function detectWithTiling(
  detector: FaceDetector,
  image: ImageSource,
  opts: TilingOptions = DEFAULT_TILING,
  onProgress?: (done: number, total: number) => void,
): Detection[] {
  const imageW = 'naturalWidth' in image ? image.naturalWidth : image.width
  const imageH = 'naturalHeight' in image ? image.naturalHeight : image.height
  const tiles = buildTiles(imageW, imageH, opts)
  const all: Detection[] = []

  for (const [i, tile] of tiles.entries()) {
    const isWhole = tile.width === imageW && tile.height === imageH
    const found = isWhole ? detector.detect(image) : detectInRegion(detector, image, tile)
    for (const d of found) {
      if (!isWhole && touchesInnerEdge(d, tile, imageW, imageH)) continue
      all.push(d)
    }
    onProgress?.(i + 1, tiles.length)
  }

  const merged = nonMaxSuppression(all, opts.nmsThreshold)
  if (!opts.verifyScore) return merged

  return merged.filter((d) =>
    detectInRegion(detector, image, contextCrop(d, imageW, imageH)).some(
      (v) => v.score >= opts.verifyScore && overlapOverMin(v, d) >= 0.3,
    ),
  )
}
