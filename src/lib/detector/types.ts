/** 원본 이미지 픽셀 좌표 기준 사각형 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 감지기가 돌려주는 얼굴 하나 */
export interface Detection extends Rect {
  score: number
}

/** 감지 입력으로 쓸 수 있는 이미지 */
export type DetectInput = ImageBitmap | HTMLCanvasElement | OffscreenCanvas | HTMLImageElement

export interface FaceDetector {
  /** 이미지 한 장(또는 타일 하나)에서 얼굴을 찾는다. 좌표는 입력 이미지 기준 픽셀. */
  detect(image: DetectInput): Detection[]
  close(): void
}
