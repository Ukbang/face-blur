import type { Dispatch } from 'react'
import type { EffectStyle, MaskShape } from '../lib/effects/render'
import type { Action, EditorState } from '../state/editorReducer'

const STYLES: { value: EffectStyle; label: string }[] = [
  { value: 'blur', label: '블러' },
  { value: 'mosaic', label: '모자이크' },
  { value: 'box', label: '검정' },
  { value: 'emoji', label: '이모지' },
]

const SHAPES: { value: MaskShape; label: string }[] = [
  { value: 'ellipse', label: '타원' },
  { value: 'rect', label: '사각형' },
]

const EMOJIS = ['🙂', '😎', '🐱', '🐶', '🌸', '⭐']

interface Props {
  state: EditorState
  showBoxes: boolean
  saving: boolean
  onToggleBoxes: () => void
  onPrecise: () => void
  onSave: () => void
  onNew: () => void
  dispatch: Dispatch<Action>
}

export function Panel({ state, showBoxes, saving, onToggleBoxes, onPrecise, onSave, onNew, dispatch }: Props) {
  const { faces, effect, status, preciseDone, image } = state
  const detecting = status === 'detecting'
  const enabledCount = faces.filter((f) => f.enabled).length
  const setEffect = (patch: Partial<typeof effect>) => dispatch({ type: 'effect', patch })

  return (
    <aside className="panel">
      <section className="panel-section">
        <h2 className="label">
          <span className="label-no">01</span> 감지 결과
        </h2>
        <p className="stat" aria-live="polite">
          {detecting ? (
            <span className="stat-sub">찾는 중…</span>
          ) : (
            <>
              <strong>{enabledCount}</strong>
              <span className="stat-sub"> / {faces.length}개 가리는 중</span>
            </>
          )}
        </p>
        {!detecting && faces.length === 0 && (
          <p className="note">얼굴을 찾지 못했어요. 사진 위를 드래그해서 가릴 영역을 직접 추가하세요.</p>
        )}
        <div className="btn-row">
          <button type="button" className="btn" disabled={detecting || !faces.length} onClick={() => dispatch({ type: 'set-all', enabled: true })}>
            모두 켜기
          </button>
          <button type="button" className="btn" disabled={detecting || !faces.length} onClick={() => dispatch({ type: 'set-all', enabled: false })}>
            모두 끄기
          </button>
        </div>
        <button type="button" className="btn btn-wide" disabled={detecting || preciseDone} onClick={onPrecise}>
          {preciseDone ? '정밀 감지 완료' : '작은 얼굴 더 찾기'}
        </button>
        <p className="hint">단체·군중 사진에서 놓친 작은 얼굴을 찾아요. 몇 초 더 걸려요.</p>
        <ul className="howto">
          <li><kbd>클릭</kbd> 박스의 블러 켜기·끄기</li>
          <li><kbd>드래그</kbd> 빈 곳에 새 영역 추가</li>
          <li><kbd>모서리</kbd> 크기 조절 · <kbd>Del</kbd> 삭제</li>
        </ul>
      </section>

      <section className="panel-section">
        <h2 className="label">
          <span className="label-no">02</span> 가리는 방식
        </h2>
        <div className="segmented" role="radiogroup" aria-label="스타일">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={effect.style === s.value}
              className={`seg seg-${s.value}`}
              onClick={() => setEffect({ style: s.value })}
            >
              <span className="seg-swatch" aria-hidden="true" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="field">
          <span className="field-label">모양</span>
          <div className="segmented segmented-sm" role="radiogroup" aria-label="모양">
            {SHAPES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={effect.shape === s.value}
                className="seg"
                onClick={() => setEffect({ shape: s.value })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {(effect.style === 'blur' || effect.style === 'mosaic') && (
          <label className="field">
            <span className="field-label">
              강도 <span className="mono">{Math.round(effect.strength * 100)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={effect.strength}
              onChange={(e) => setEffect({ strength: Number(e.target.value) })}
            />
            <span className="hint">가장 약한 단계도 얼굴을 알아보기 어려울 만큼 강하게 처리해요.</span>
          </label>
        )}

        {effect.style === 'emoji' && (
          <div className="field">
            <span className="field-label">이모지</span>
            <div className="emoji-row" role="radiogroup" aria-label="이모지">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  role="radio"
                  aria-checked={effect.emoji === em}
                  className="emoji"
                  onClick={() => setEffect({ emoji: em })}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel-section panel-actions">
        <div className="actions-row">
          <label className="switch">
            <input type="checkbox" checked={showBoxes} onChange={onToggleBoxes} />
            <span className="switch-track" aria-hidden="true" />
            박스 표시
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onNew}>
            새 사진
          </button>
        </div>
        <button type="button" className="btn btn-primary" disabled={detecting || saving} onClick={onSave}>
          {saving ? '저장 중…' : '저장하기'}
        </button>
        <p className="hint">
          {image && `${image.width}×${image.height} 원본 해상도로 저장돼요. `}위치정보(EXIF)는 남지 않아요.
        </p>
      </section>
    </aside>
  )
}
