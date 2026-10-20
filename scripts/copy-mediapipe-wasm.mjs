// MediaPipe WASM 런타임을 node_modules에서 public/으로 복사한다.
// CDN 대신 직접 호스팅해서 사진 처리 중 외부 요청이 생기지 않게 한다.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = join(root, 'public/mediapipe')

if (!existsSync(src)) {
  console.error(`[copy-mediapipe-wasm] ${src} 가 없습니다. npm install 을 먼저 실행하세요.`)
  process.exit(1)
}

mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log(`[copy-mediapipe-wasm] ${src} → ${dest}`)
