import type { WorkerRequest, WorkerResponse } from './protocol'
import type { Detection } from './types'

export interface DetectorClient {
  /** 모델과 WASM 로딩이 끝나면 resolve */
  ready: Promise<void>
  detect(source: CanvasImageSource & { width: number; height: number }, precise: boolean, onProgress?: (ratio: number) => void): Promise<Detection[]>
  terminate(): void
}

interface Pending {
  resolve: (d: Detection[]) => void
  reject: (e: Error) => void
  onProgress?: (ratio: number) => void
}

/** 감지 워커를 띄우고 요청/응답을 Promise로 감싼다. */
export function createDetectorClient(): DetectorClient {
  const worker = new Worker(new URL('./detect.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, Pending>()
  let nextId = 1

  let readyResolve!: () => void
  let readyReject!: (e: Error) => void
  const ready = new Promise<void>((res, rej) => {
    readyResolve = res
    readyReject = rej
  })

  const post = (msg: WorkerRequest, transfer: Transferable[] = []) => worker.postMessage(msg, transfer)

  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data
    switch (msg.type) {
      case 'ready':
        readyResolve()
        break
      case 'progress':
        pending.get(msg.id)?.onProgress?.(msg.done / msg.total)
        break
      case 'result':
        pending.get(msg.id)?.resolve(msg.detections)
        pending.delete(msg.id)
        break
      case 'error':
        if (msg.id === undefined) {
          readyReject(new Error(msg.message))
        } else {
          pending.get(msg.id)?.reject(new Error(msg.message))
          pending.delete(msg.id)
        }
        break
    }
  }
  worker.onerror = (e) => {
    const err = new Error(e.message || '감지 워커를 시작하지 못했습니다')
    readyReject(err)
    for (const p of pending.values()) p.reject(err)
    pending.clear()
  }

  post({ type: 'init' })

  return {
    ready,
    async detect(source, precise, onProgress) {
      // 워커로 소유권을 넘길 복사본. 원본은 화면 렌더링에 계속 쓴다.
      const bitmap = await createImageBitmap(source)
      const id = nextId++
      return new Promise<Detection[]>((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress })
        post({ type: 'detect', id, bitmap, precise }, [bitmap])
      })
    },
    terminate: () => worker.terminate(),
  }
}
