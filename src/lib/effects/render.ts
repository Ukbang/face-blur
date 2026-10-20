import type { Rect } from '../detector/types'
import type { Face } from '../faces'
import { boxBlur } from './boxBlur'

export type EffectStyle = 'blur' | 'mosaic' | 'box' | 'emoji'
export type MaskShape = 'rect' | 'ellipse'

export interface EffectOptions {
  style: EffectStyle
  shape: MaskShape
  /** 0(약) ~ 1(강). 가장 약해도 얼굴을 알아볼 수 없는 수준이 하한이다. */
  strength: number
  emoji: string
}

export const DEFAULT_EFFECT: EffectOptions = {
  style: 'blur',
  shape: 'ellipse',
  strength: 0.6,
  emoji: '🙂',
}

type Ctx = CanvasRenderingContext2D

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))

/**
 * 얼굴 긴 변을 몇 칸으로 줄일지. 칸이 적을수록 정보가 많이 사라져 복원할 수 없다.
 * 블러: 10칸(약)~3칸(강), 모자이크: 8블록(약)~3블록(강).
 * 비율로 정하므로 미리보기와 원본 해상도 저장 결과가 같다.
 */
export function cellsAcross(style: 'blur' | 'mosaic', strength: number): number {
  return Math.round(style === 'blur' ? lerp(10, 3, strength) : lerp(8, 3, strength))
}

/** 얼굴 영역을 긴 변 cells칸 크기로 줄인 작은 캔버스 */
function shrink(source: CanvasImageSource, r: Rect, cells: number): HTMLCanvasElement {
  const longSide = Math.max(r.width, r.height)
  const small = document.createElement('canvas')
  small.width = Math.max(1, Math.round((cells * r.width) / longSide))
  small.height = Math.max(1, Math.round((cells * r.height) / longSide))
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(source, r.x, r.y, r.width, r.height, 0, 0, small.width, small.height)
  return small
}

function maskPath(ctx: Ctx, d: Rect, shape: MaskShape) {
  ctx.beginPath()
  if (shape === 'ellipse') {
    ctx.ellipse(d.x + d.width / 2, d.y + d.height / 2, d.width / 2, d.height / 2, 0, 0, Math.PI * 2)
  } else {
    ctx.rect(d.x, d.y, d.width, d.height)
  }
}

function drawBlur(ctx: Ctx, source: CanvasImageSource, r: Rect, d: Rect, strength: number) {
  const small = shrink(source, r, cellsAcross('blur', strength))
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  const img = sctx.getImageData(0, 0, small.width, small.height)
  boxBlur(img.data, small.width, small.height, 1)
  sctx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, d.x, d.y, d.width, d.height)
}

function drawMosaic(ctx: Ctx, source: CanvasImageSource, r: Rect, d: Rect, strength: number) {
  const small = shrink(source, r, cellsAcross('mosaic', strength))
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(small, d.x, d.y, d.width, d.height)
  ctx.imageSmoothingEnabled = true
}

function drawEmoji(ctx: Ctx, d: Rect, emoji: string) {
  const size = Math.max(d.width, d.height)
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, d.x + d.width / 2, d.y + d.height / 2 + size * 0.05)
}

/**
 * ctx에 원본(source)을 scale 배율로 그리고, 켜진 얼굴마다 효과를 입힌다.
 * 효과는 항상 원본 해상도 source에서 샘플링한다.
 */
export function renderScene(
  ctx: Ctx,
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  faces: Face[],
  opts: EffectOptions,
  scale = 1,
): void {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, sourceW * scale, sourceH * scale)

  for (const f of faces) {
    if (!f.enabled) continue
    const d = { x: f.x * scale, y: f.y * scale, width: f.width * scale, height: f.height * scale }
    ctx.save()
    maskPath(ctx, d, opts.shape)
    if (opts.style === 'box') {
      ctx.fillStyle = '#111'
      ctx.fill()
    } else {
      ctx.clip()
      if (opts.style === 'mosaic') drawMosaic(ctx, source, f, d, opts.strength)
      // 이모지는 글리프 모양 사이로 얼굴이 비치지 않게 가장 강한 블러를 밑에 깐다.
      else drawBlur(ctx, source, f, d, opts.style === 'emoji' ? 1 : opts.strength)
    }
    ctx.restore()
    if (opts.style === 'emoji') drawEmoji(ctx, d, opts.emoji)
  }
}
