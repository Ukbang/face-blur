import { describe, expect, it } from 'vitest'
import { nonMaxSuppression, overlapOverMin } from '../../src/lib/detector/nms'
import { buildTiles, contextCrop, minTileFor, tileStarts, touchesInnerEdge } from '../../src/lib/detector/tiling'

describe('overlapOverMin', () => {
  it('작은 박스가 큰 박스 안에 완전히 들어가면 1', () => {
    expect(overlapOverMin({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 20, height: 20 })).toBe(1)
  })
  it('겹치지 않으면 0', () => {
    expect(overlapOverMin({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 })).toBe(0)
  })
})

describe('nonMaxSuppression', () => {
  it('겹치는 박스 중 점수 높은 것만 남긴다', () => {
    const kept = nonMaxSuppression([
      { x: 0, y: 0, width: 100, height: 100, score: 0.6 },
      { x: 5, y: 5, width: 100, height: 100, score: 0.9 },
      { x: 300, y: 300, width: 50, height: 50, score: 0.7 },
    ])
    expect(kept.map((k) => k.score)).toEqual([0.9, 0.7])
  })
  it('타일 경계에서 잘린 박스(큰 박스에 포함)도 중복으로 제거한다', () => {
    const kept = nonMaxSuppression([
      { x: 0, y: 0, width: 100, height: 100, score: 0.8 },
      { x: 0, y: 0, width: 40, height: 100, score: 0.85 },
    ])
    expect(kept).toHaveLength(1)
  })
})

describe('tileStarts', () => {
  it('타일이 전체보다 크면 하나', () => {
    expect(tileStarts(500, 800, 0.3)).toEqual([0])
  })
  it('마지막 타일은 끝에 맞추고 전체를 덮는다', () => {
    const starts = tileStarts(1000, 400, 0.25)
    expect(starts[0]).toBe(0)
    expect(starts.at(-1)).toBe(600)
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeLessThanOrEqual(400)
  })
})

describe('buildTiles', () => {
  it('첫 타일은 이미지 전체', () => {
    expect(buildTiles(4000, 3000)[0]).toEqual({ x: 0, y: 0, width: 4000, height: 3000 })
  })
  it('모든 타일이 이미지 안에 있다', () => {
    for (const t of buildTiles(4000, 3000)) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.y).toBeGreaterThanOrEqual(0)
      expect(t.x + t.width).toBeLessThanOrEqual(4000)
      expect(t.y + t.height).toBeLessThanOrEqual(3000)
    }
  })
  it('작은 이미지는 전체 한 장만', () => {
    expect(buildTiles(600, 400)).toHaveLength(1)
  })
})

describe('touchesInnerEdge', () => {
  const tile = { x: 500, y: 0, width: 500, height: 500 }
  it('내부 경계(왼쪽)에 닿으면 true', () => {
    expect(touchesInnerEdge({ x: 500, y: 100, width: 50, height: 50 }, tile, 2000, 2000)).toBe(true)
  })
  it('이미지 테두리(위쪽)에 닿는 건 잘린 게 아니므로 false', () => {
    expect(touchesInnerEdge({ x: 600, y: 0, width: 50, height: 50 }, tile, 2000, 2000)).toBe(false)
  })
})

describe('contextCrop', () => {
  it('박스 중심 기준 3배 정사각형', () => {
    expect(contextCrop({ x: 100, y: 100, width: 20, height: 20 }, 1000, 1000)).toEqual({ x: 80, y: 80, width: 60, height: 60 })
  })
  it('이미지 밖은 잘라낸다', () => {
    expect(contextCrop({ x: 0, y: 0, width: 20, height: 20 }, 1000, 1000)).toEqual({ x: 0, y: 0, width: 40, height: 40 })
  })
})

describe('minTileFor', () => {
  it('3840px 사진은 실험값과 같다 (빠름 480, 정밀 240)', () => {
    expect(minTileFor(3840, false)).toBe(480)
    expect(minTileFor(3840, true)).toBe(240)
  })
  it('작은 사진은 하한까지 더 잘게 쪼갠다', () => {
    expect(minTileFor(1600, false)).toBe(240)
    expect(minTileFor(1600, true)).toBe(160)
  })
})
