import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Panel } from './components/Panel'
import { Stage } from './components/Stage'
import { UploadZone } from './components/UploadZone'
import { createDetectorClient, type DetectorClient } from './lib/detector/client'
import { detectionsToFaces } from './lib/faces'
import { downloadBlob, exportFileName, exportImage } from './lib/image/export'
import { ImageLoadError, loadImageFile, type LoadedImage } from './lib/image/load'
import { editorReducer, initialState } from './state/editorReducer'

type ModelState = 'loading' | 'ready' | 'error'

export default function App() {
  const [state, dispatch] = useReducer(editorReducer, initialState)
  const [modelState, setModelState] = useState<ModelState>('loading')
  const [showBoxes, setShowBoxes] = useState(true)
  const [saving, setSaving] = useState(false)
  const clientRef = useRef<DetectorClient | null>(null)
  /** 감지 도중 새 사진을 열면 이전 결과를 버리기 위한 현재 사진 */
  const imageRef = useRef<LoadedImage | null>(null)

  // 페이지를 열자마자 모델을 미리 불러와서 사진을 고르는 동안 준비해 둔다.
  useEffect(() => {
    const client = createDetectorClient()
    clientRef.current = client
    client.ready.then(
      () => setModelState('ready'),
      () => setModelState('error'),
    )
    return () => client.terminate()
  }, [])

  const runDetection = useCallback(async (image: LoadedImage, precise: boolean) => {
    const client = clientRef.current
    if (!client) return
    try {
      const detections = await client.detect(image.canvas, precise, (p) => {
        if (imageRef.current === image) dispatch({ type: 'progress', progress: p })
      })
      if (imageRef.current !== image) return
      const faces = detectionsToFaces(detections, image.width, image.height)
      dispatch(precise ? { type: 'precise-done', faces } : { type: 'detect-done', faces })
    } catch {
      if (imageRef.current !== image) return
      dispatch(precise ? { type: 'precise-done', faces: [] } : { type: 'detect-done', faces: [] })
      dispatch({ type: 'fail', error: '얼굴 감지에 실패했어요. 사진 위를 드래그해서 직접 영역을 추가할 수 있어요.' })
    }
  }, [])

  const openFile = useCallback(
    async (file: File) => {
      dispatch({ type: 'load-start' })
      try {
        const image = await loadImageFile(file)
        imageRef.current = image
        dispatch({ type: 'load-done', image })
        await runDetection(image, false)
      } catch (e) {
        const message = e instanceof ImageLoadError ? e.message : '사진을 열지 못했어요.'
        dispatch({ type: 'fail', error: message })
      }
    },
    [runDetection],
  )

  const precise = () => {
    if (!state.image) return
    dispatch({ type: 'precise-start' })
    runDetection(state.image, true)
  }

  const save = async () => {
    if (!state.image) return
    setSaving(true)
    try {
      const blob = await exportImage(state.image, state.faces, state.effect)
      downloadBlob(blob, exportFileName(state.image))
    } catch {
      dispatch({ type: 'fail', error: '저장하지 못했어요. 사진이 너무 크면 다른 브라우저에서 시도해 보세요.' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    imageRef.current = null
    dispatch({ type: 'reset' })
  }

  // 붙여넣기(Ctrl+V)로 사진 열기
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (file) openFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [openFile])

  // 선택한 영역 삭제(Delete/Backspace)와 선택 해제(Esc)
  const { selectedId } = state
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        dispatch({ type: 'remove', id: selectedId })
      } else if (e.key === 'Escape') {
        dispatch({ type: 'select', id: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const { image, status, error } = state

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={reset} aria-label="처음으로">
          <span className="brand-mark" aria-hidden="true" />
          얼굴 블러
        </button>
        <p className="stamp mono" title="사진은 이 브라우저 안에서만 처리되고 어디에도 업로드되지 않습니다">
          <span className="stamp-dot" aria-hidden="true" />
          업로드 0 B<span className="stamp-text-long"> · 기기 안에서만 처리</span>
        </p>
      </header>

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => dispatch({ type: 'dismiss-error' })} aria-label="닫기">
            ✕
          </button>
        </div>
      )}

      {!image ? (
        <UploadZone loading={status === 'loading'} modelState={modelState} onFile={openFile} />
      ) : (
        <main className="editor">
          <div className="editor-stage" style={{ '--img-aspect': image.width / image.height } as CSSProperties}>
            {image.downscaledFrom && (
              <p className="banner">
                원본({image.downscaledFrom.width}×{image.downscaledFrom.height})이 너무 커서 {image.width}×{image.height}로 줄여
                처리했어요.
              </p>
            )}
            <Stage
              image={image}
              faces={state.faces}
              effect={state.effect}
              selectedId={state.selectedId}
              showBoxes={showBoxes}
              detecting={status === 'detecting'}
              progress={state.progress}
              modelReady={modelState === 'ready'}
              dispatch={dispatch}
            />
          </div>
          <Panel
            state={state}
            showBoxes={showBoxes}
            saving={saving}
            onToggleBoxes={() => setShowBoxes((v) => !v)}
            onPrecise={precise}
            onSave={save}
            onNew={reset}
            dispatch={dispatch}
          />
        </main>
      )}
    </div>
  )
}
