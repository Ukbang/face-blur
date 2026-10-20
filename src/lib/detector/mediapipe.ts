import { FaceDetector as MPFaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import type { DetectInput, Detection, FaceDetector } from './types'

export type MediaPipeModel = 'short' | 'full'

const MODEL_PATHS: Record<MediaPipeModel, string> = {
  short: '/models/blaze_face_short_range.tflite',
  full: '/models/blaze_face_full_range.tflite',
}

export interface MediaPipeOptions {
  model: MediaPipeModel
  minConfidence: number
  /** ES 모듈 워커 안에서 쓸 때 true */
  useModule?: boolean
}

export async function createMediaPipeDetector(opts: MediaPipeOptions): Promise<FaceDetector> {
  // 절대 URL로 넘긴다. 상대 경로면 Vite 개발 서버가 워커의 동적 import에 ?import를 붙여 public/ 파일을 거부한다.
  const wasmBase = new URL('/mediapipe', globalThis.location.href).href
  const fileset = await FilesetResolver.forVisionTasks(wasmBase, opts.useModule ?? false)
  const mp = await MPFaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATHS[opts.model], delegate: 'CPU' },
    runningMode: 'IMAGE',
    minDetectionConfidence: opts.minConfidence,
    minSuppressionThreshold: 0.3,
  })

  return {
    detect(image: DetectInput): Detection[] {
      const result = mp.detect(image)
      return result.detections.flatMap((d) => {
        const b = d.boundingBox
        if (!b) return []
        return [{ x: b.originX, y: b.originY, width: b.width, height: b.height, score: d.categories[0]?.score ?? 0 }]
      })
    },
    close: () => mp.close(),
  }
}
