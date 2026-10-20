import type { Detection } from './types'

/** 메인 스레드 → 감지 워커 */
export type WorkerRequest =
  | { type: 'init' }
  | { type: 'detect'; id: number; bitmap: ImageBitmap; precise: boolean }

/** 감지 워커 → 메인 스레드 */
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'result'; id: number; detections: Detection[] }
  | { type: 'error'; id?: number; message: string }
