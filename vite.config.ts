import react from '@vitejs/plugin-react'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * 콘텐츠 보안 정책. connect-src 'self'로 브라우저가 외부로 데이터를 보내는 것 자체를 막는다.
 * 'wasm-unsafe-eval'은 MediaPipe WASM 컴파일에 필요하다.
 * 배포 서버 헤더(vercel.json)에도 같은 정책을 넣는다. meta로는 frame-ancestors를 지정할 수 없어서다.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

/** 빌드 결과물에만 CSP meta를 넣는다. 개발 서버는 HMR용 인라인 스크립트·웹소켓을 써야 해서 제외한다. */
function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  }
}

/**
 * 앱은 감지를 ES 모듈 워커에서 돌리므로 MediaPipe의 모듈용 WASM만 쓴다.
 * 일반/nosimd 변형(약 26MB)은 개발용 실험 페이지(spike/)에서만 필요하니 빌드 결과에서 뺀다.
 */
function dropUnusedWasm(): Plugin {
  return {
    name: 'drop-unused-mediapipe-wasm',
    apply: 'build',
    closeBundle() {
      for (const f of ['vision_wasm_internal', 'vision_wasm_nosimd_internal']) {
        for (const ext of ['js', 'wasm']) rmSync(resolve('dist/mediapipe', `${f}.${ext}`), { force: true })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspMeta(), dropUnusedWasm()],
  worker: { format: 'es' },
})
