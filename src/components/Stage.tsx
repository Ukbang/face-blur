import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type PointerEvent } from 'react'
import type { Rect } from '../lib/detector/types'
import { renderScene, type EffectOptions } from '../lib/effects/render'
import { clampRect, type Face } from '../lib/faces'
import type { LoadedImage } from '../lib/image/load'
import type { Action } from '../state/editorReducer'

type Corner = 'nw' | 'ne' | 'sw' | 'se'
type Pt = { x: number; y: number }

type Drag =
  | { kind: 'draw'; start: Pt; current: Pt }
  | { kind: 'move'; id: string; start: Pt; orig: Rect; moved: boolean }
  | { kind: 'resize'; id: string; corner: Corner; orig: Rect }

interface Props {
  image: LoadedImage
  faces: Face[]
  effect: EffectOptions
  selectedId: string | null
  showBoxes: boolean
  detecting: boolean
  progress: number
  modelReady: boolean
  dispatch: Dispatch<Action>
}

/** 드래그로 만든 사각형이 이보다 작으면(화면 px) 클릭으로 본다 */
const MIN_DRAW_PX = 6
/** 박스를 이만큼(화면 px) 움직이기 전까지는 클릭(토글)으로 본다 */
const CLICK_SLOP_PX = 4
const HANDLE_PX = 12

function normalize(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

function resizeFrom(orig: Rect, corner: Corner, p: Pt): Rect {
  const fixed = {
    x: corner.includes('w') ? orig.x + orig.width : orig.x,
    y: corner.includes('n') ? orig.y + orig.height : orig.y,
  }
  return normalize(fixed, p)
}

export function Stage({ image, faces, effect, selectedId, showBoxes, detecting, progress, modelReady, dispatch }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [drawRect, setDrawRect] = useState<Rect | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // 화면에 맞는 표시 크기 계산
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const fit = Math.min(width / image.width, height / image.height)
      setSize({ w: Math.floor(image.width * fit), h: Math.floor(image.height * fit) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [image])

  // 미리보기 렌더링: 화면 해상도로만 그린다. 저장은 원본 해상도로 따로 렌더링한다.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.w) return
    const raf = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(size.w * dpr)
      const h = Math.round(size.h * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      renderScene(canvas.getContext('2d')!, image.canvas, image.width, image.height, faces, effect, w / image.width)
    })
    return () => cancelAnimationFrame(raf)
  }, [image, faces, effect, size])

  /** 화면 px 1개가 이미지 px 몇 개인지 */
  const unit = size.w ? image.width / size.w : 1

  const toImage = (e: PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.min(image.width, Math.max(0, ((e.clientX - r.left) / r.width) * image.width)),
      y: Math.min(image.height, Math.max(0, ((e.clientY - r.top) / r.height) * image.height)),
    }
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const target = e.target as SVGElement
    const p = toImage(e)
    const faceId = target.dataset.faceId
    const corner = target.dataset.corner as Corner | undefined
    const face = faces.find((f) => f.id === faceId)

    if (face && corner) {
      dragRef.current = { kind: 'resize', id: face.id, corner, orig: { ...face } }
    } else if (face) {
      dragRef.current = { kind: 'move', id: face.id, start: p, orig: { ...face }, moved: false }
    } else {
      dragRef.current = { kind: 'draw', start: p, current: p }
    }
    svgRef.current!.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const p = toImage(e)
    if (drag.kind === 'draw') {
      drag.current = p
      setDrawRect(normalize(drag.start, p))
    } else if (drag.kind === 'move') {
      const dx = p.x - drag.start.x
      const dy = p.y - drag.start.y
      if (!drag.moved && Math.hypot(dx, dy) < CLICK_SLOP_PX * unit) return
      drag.moved = true
      const rect = clampRect({ ...drag.orig, x: drag.orig.x + dx, y: drag.orig.y + dy }, image.width, image.height)
      dispatch({ type: 'update-rect', id: drag.id, rect })
    } else {
      const rect = clampRect(resizeFrom(drag.orig, drag.corner, p), image.width, image.height, MIN_DRAW_PX * unit)
      dispatch({ type: 'update-rect', id: drag.id, rect })
    }
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.kind === 'draw') {
      setDrawRect(null)
      const rect = normalize(drag.start, drag.current)
      if (rect.width >= MIN_DRAW_PX * unit && rect.height >= MIN_DRAW_PX * unit) {
        dispatch({ type: 'add', rect: clampRect(rect, image.width, image.height) })
      } else {
        dispatch({ type: 'select', id: null })
      }
    } else if (drag.kind === 'move') {
      if (!drag.moved) dispatch({ type: 'toggle', id: drag.id })
      dispatch({ type: 'select', id: drag.id })
    }
  }

  const selected = faces.find((f) => f.id === selectedId)
  const handle = HANDLE_PX * unit

  return (
    <div className="stage" ref={wrapRef}>
      <div className="stage-frame" style={{ width: size.w, height: size.h }}>
        <canvas ref={canvasRef} className="stage-canvas" style={{ width: size.w, height: size.h }} />

        {showBoxes && !detecting && (
          <svg
            ref={svgRef}
            className="overlay"
            viewBox={`0 0 ${image.width} ${image.height}`}
            width={size.w}
            height={size.h}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="application"
            aria-label="얼굴 영역 편집. 박스를 클릭하면 블러를 켜고 끄고, 빈 곳을 드래그하면 영역을 추가합니다."
          >
            {faces.map((f) => (
              <rect
                key={f.id}
                data-face-id={f.id}
                className={`face ${f.enabled ? 'on' : 'off'} ${f.id === selectedId ? 'selected' : ''}`}
                x={f.x}
                y={f.y}
                width={f.width}
                height={f.height}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {selected &&
              (['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                <rect
                  key={c}
                  data-face-id={selected.id}
                  data-corner={c}
                  className={`handle handle-${c}`}
                  x={(c.includes('w') ? selected.x : selected.x + selected.width) - handle / 2}
                  y={(c.includes('n') ? selected.y : selected.y + selected.height) - handle / 2}
                  width={handle}
                  height={handle}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {drawRect && (
              <rect className="drawing" {...drawRect} vectorEffect="non-scaling-stroke" />
            )}
          </svg>
        )}

        {showBoxes && !detecting && selected && (
          <div
            className="face-menu"
            style={{
              left: Math.min(selected.x / unit, size.w - 150),
              top: selected.y / unit > 44 ? selected.y / unit - 40 : (selected.y + selected.height) / unit + 8,
            }}
          >
            <button type="button" onClick={() => dispatch({ type: 'toggle', id: selected.id })}>
              {selected.enabled ? '블러 끄기' : '블러 켜기'}
            </button>
            <button type="button" className="danger" onClick={() => dispatch({ type: 'remove', id: selected.id })}>
              삭제
            </button>
          </div>
        )}

        {detecting && (
          <div className="scan" role="status" aria-live="polite">
            <div className="scan-line" />
            <div className="scan-label">
              {modelReady ? `얼굴 찾는 중 ${Math.round(progress * 100)}%` : '감지 모델 불러오는 중…'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
