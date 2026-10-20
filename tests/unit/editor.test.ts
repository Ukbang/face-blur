import { describe, expect, it } from 'vitest'
import { boxBlur } from '../../src/lib/effects/boxBlur'
import { cellsAcross } from '../../src/lib/effects/render'
import { clampRect, expandFaceBox, newFacesOnly, type Face } from '../../src/lib/faces'
import { fitWithinPixels, isSupported, MAX_PIXELS } from '../../src/lib/image/load'
import { editorReducer, initialState, type EditorState } from '../../src/state/editorReducer'

const face = (id: string, x: number, y: number, size = 50, enabled = true): Face => ({
  id,
  x,
  y,
  width: size,
  height: size,
  enabled,
  source: 'auto',
})

describe('expandFaceBox', () => {
  it('좌우 20%, 위 35%, 아래 15% 넓힌다', () => {
    expect(expandFaceBox({ x: 100, y: 100, width: 100, height: 100 }, 1000, 1000)).toEqual({
      x: 80,
      y: 65,
      width: 140,
      height: 150,
    })
  })
  it('이미지 밖으로 나가지 않는다', () => {
    const r = expandFaceBox({ x: 0, y: 0, width: 100, height: 100 }, 110, 110)
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
    expect(r.x + r.width).toBeLessThanOrEqual(110)
    expect(r.y + r.height).toBeLessThanOrEqual(110)
  })
})

describe('clampRect', () => {
  it('이미지 밖으로 끌면 안쪽으로 밀어 넣는다', () => {
    expect(clampRect({ x: 980, y: -20, width: 50, height: 50 }, 1000, 1000)).toEqual({ x: 950, y: 0, width: 50, height: 50 })
  })
  it('최소 크기를 보장한다', () => {
    expect(clampRect({ x: 10, y: 10, width: 1, height: 1 }, 1000, 1000, 8)).toMatchObject({ width: 8, height: 8 })
  })
})

describe('newFacesOnly', () => {
  it('기존 영역(해제한 것 포함)과 겹치는 감지는 버린다', () => {
    const existing = [face('a', 0, 0), face('b', 200, 200, 50, false)]
    const found = [face('x', 5, 5), face('y', 205, 205), face('z', 500, 500)]
    expect(newFacesOnly(existing, found).map((f) => f.id)).toEqual(['z'])
  })
})

describe('fitWithinPixels', () => {
  it('12MP 폰 사진은 그대로', () => {
    expect(fitWithinPixels(4032, 3024)).toEqual({ width: 4032, height: 3024 })
  })
  it('48MP 사진은 비율을 유지하며 한도 안으로 줄인다', () => {
    const r = fitWithinPixels(8064, 6048)
    expect(r.width * r.height).toBeLessThanOrEqual(MAX_PIXELS)
    expect(r.width / r.height).toBeCloseTo(8064 / 6048, 2)
  })
})

describe('isSupported', () => {
  it('JPEG/PNG/WebP만 받는다', () => {
    expect(isSupported('image/jpeg')).toBe(true)
    expect(isSupported('image/heic')).toBe(false)
    expect(isSupported('image/gif')).toBe(false)
  })
})

describe('cellsAcross', () => {
  it('강할수록 칸이 적고, 가장 약해도 블러 10칸·모자이크 8블록을 넘지 않는다', () => {
    expect(cellsAcross('blur', 0)).toBe(10)
    expect(cellsAcross('blur', 1)).toBe(3)
    expect(cellsAcross('mosaic', 0)).toBe(8)
    expect(cellsAcross('mosaic', 1)).toBe(3)
  })
})

describe('boxBlur', () => {
  it('단색은 그대로, 점 하나는 주변으로 퍼진다', () => {
    const w = 5
    const h = 5
    const data = new Uint8ClampedArray(w * h * 4).fill(100)
    boxBlur(data, w, h, 1)
    expect([...data].every((v) => v === 100)).toBe(true)

    const dot = new Uint8ClampedArray(w * h * 4)
    dot[(2 * w + 2) * 4] = 255
    boxBlur(dot, w, h, 1, 1)
    expect(dot[(2 * w + 2) * 4]).toBeLessThan(255)
    expect(dot[(2 * w + 1) * 4]).toBeGreaterThan(0)
  })
})

describe('editorReducer', () => {
  const ready: EditorState = { ...initialState, status: 'ready', faces: [face('a', 0, 0), face('b', 100, 100)] }

  it('toggle은 해당 영역만 켜고 끈다', () => {
    const s = editorReducer(ready, { type: 'toggle', id: 'a' })
    expect(s.faces.map((f) => f.enabled)).toEqual([false, true])
  })

  it('add는 수동 영역을 만들고 선택한다', () => {
    const s = editorReducer(ready, { type: 'add', rect: { x: 300, y: 300, width: 40, height: 40 } })
    expect(s.faces).toHaveLength(3)
    expect(s.faces[2].source).toBe('manual')
    expect(s.selectedId).toBe(s.faces[2].id)
  })

  it('remove는 선택도 함께 해제한다', () => {
    const s = editorReducer({ ...ready, selectedId: 'a' }, { type: 'remove', id: 'a' })
    expect(s.faces.map((f) => f.id)).toEqual(['b'])
    expect(s.selectedId).toBeNull()
  })

  it('precise-done은 겹치지 않는 새 얼굴만 더한다', () => {
    const s = editorReducer(ready, { type: 'precise-done', faces: [face('dup', 2, 2), face('new', 400, 400)] })
    expect(s.faces.map((f) => f.id)).toEqual(['a', 'b', 'new'])
    expect(s.preciseDone).toBe(true)
  })

  it('새 사진을 열어도 스타일 설정은 유지한다', () => {
    const styled = editorReducer(ready, { type: 'effect', patch: { style: 'mosaic' } })
    const s = editorReducer(styled, { type: 'load-start' })
    expect(s.faces).toEqual([])
    expect(s.effect.style).toBe('mosaic')
  })

  it('사진이 열린 상태의 실패는 편집을 계속할 수 있게 ready로 둔다', () => {
    const withImage = { ...ready, image: {} as EditorState['image'] }
    expect(editorReducer(withImage, { type: 'fail', error: 'x' }).status).toBe('ready')
    expect(editorReducer(initialState, { type: 'fail', error: 'x' }).status).toBe('idle')
  })
})
