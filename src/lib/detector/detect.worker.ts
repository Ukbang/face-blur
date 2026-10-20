/// <reference lib="webworker" />
// 얼굴 감지 워커. 감지는 타일 수십 개를 도는 무거운 작업이라 UI 스레드와 분리한다.
import { createMediaPipeDetector } from './mediapipe'
import type { WorkerRequest, WorkerResponse } from './protocol'
import { DEFAULT_TILING, detectWithTiling, minTileFor } from './tiling'
import type { FaceDetector } from './types'

declare const self: DedicatedWorkerGlobalScope

let detector: Promise<FaceDetector> | null = null

function getDetector(): Promise<FaceDetector> {
  detector ??= createMediaPipeDetector({ model: 'full', minConfidence: 0.5, useModule: true })
  return detector
}

function send(msg: WorkerResponse) {
  self.postMessage(msg)
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'init') {
    try {
      await getDetector()
      send({ type: 'ready' })
    } catch (err) {
      detector = null
      send({ type: 'error', message: String(err) })
    }
    return
  }

  const { id, bitmap, precise } = msg
  try {
    const d = await getDetector()
    const detections = detectWithTiling(
      d,
      bitmap,
      // 정밀 감지는 타일을 더 작게 쪼개 작은 얼굴을 더 찾는다 (docs/SPIKE_RESULTS.md)
      { ...DEFAULT_TILING, minTileSize: minTileFor(Math.max(bitmap.width, bitmap.height), precise) },
      (done, total) => send({ type: 'progress', id, done, total }),
    )
    send({ type: 'result', id, detections })
  } catch (err) {
    send({ type: 'error', id, message: String(err) })
  } finally {
    bitmap.close()
  }
}
