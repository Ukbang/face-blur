import { useRef, useState, type DragEvent } from 'react'
import { SUPPORTED_TYPES } from '../lib/image/load'

interface Props {
  loading: boolean
  modelState: 'loading' | 'ready' | 'error'
  onFile: (file: File) => void
}

export function UploadZone({ loading, modelState, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <main className="landing">
      <div className="landing-copy">
        <h1 className="headline">
          사진 속 얼굴,
          <br />
          <span className="redact">한 번에</span> 가리기
        </h1>
        <p className="lede">
          올리면 얼굴을 자동으로 찾아 블러 처리합니다. 사진은 서버로 가지 않고 이 브라우저 안에서만 처리돼요.
        </p>
        <ol className="features">
          <li>
            <span className="mono">01</span>
            <b>자동 감지</b> 단체 사진의 작은 얼굴까지
          </li>
          <li>
            <span className="mono">02</span>
            <b>직접 수정</b> 클릭으로 끄고, 드래그로 추가
          </li>
          <li>
            <span className="mono">03</span>
            <b>외부 전송 없음</b> 모든 처리가 기기 안에서
          </li>
        </ol>
      </div>

      <div
        className={`dropzone ${over ? 'over' : ''} ${loading ? 'busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span className="crop crop-tl" aria-hidden="true" />
        <span className="crop crop-tr" aria-hidden="true" />
        <span className="crop crop-bl" aria-hidden="true" />
        <span className="crop crop-br" aria-hidden="true" />
        <div className="dropzone-inner">
          <div className="drop-face" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <button type="button" className="btn btn-primary btn-lg" disabled={loading} onClick={() => inputRef.current?.click()}>
            {loading ? '사진 여는 중…' : '사진 선택'}
          </button>
          <p className="drop-hint">또는 여기에 끌어다 놓기 · 붙여넣기</p>
          <p className="drop-types mono">JPEG · PNG · WebP</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_TYPES.join(',')}
          hidden
          data-testid="file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ''
          }}
        />
        <p className={`model-status mono ${modelState}`}>
          {modelState === 'loading' && '● 감지 모델 준비 중'}
          {modelState === 'ready' && '● 감지 모델 준비 완료'}
          {modelState === 'error' && '● 감지 모델을 불러오지 못했어요 — 새로고침 해주세요'}
        </p>
      </div>
    </main>
  )
}
