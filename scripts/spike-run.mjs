// 감지 실험 실행기: Vite 개발 서버를 띄우고 Chromium에서 설정별로 감지를 돌린 뒤
// spike/results/에 수치(JSON)와 박스를 그린 이미지를 저장한다.
// 사용법: node scripts/spike-run.mjs [설정이름,...]
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'spike/results')

const CONFIGS = [
  { name: 'short-whole', model: 'short', tiling: false, minConfidence: 0.5 },
  { name: 'full-whole', model: 'full', tiling: false, minConfidence: 0.5 },
  { name: 'short-tiled', model: 'short', tiling: {}, minConfidence: 0.5 },
  { name: 'full-tiled', model: 'full', tiling: {}, minConfidence: 0.5 },
  { name: 'full-tiled-v50', model: 'full', tiling: { verifyScore: 0.5 }, minConfidence: 0.5 },
  { name: 'full-tiled-v60', model: 'full', tiling: { verifyScore: 0.6 }, minConfidence: 0.5 },
  { name: 'full-tiled-240', model: 'full', tiling: { minTileSize: 240, verifyScore: 0.5 }, minConfidence: 0.5 },
]

const only = process.argv[2]?.split(',')
const configs = only ? CONFIGS.filter((c) => only.includes(c.name)) : CONFIGS
const images = readdirSync(join(root, 'spike/images'))
  .filter((f) => f.endsWith('.jpg'))
  .map((f) => f.replace(/\.jpg$/, ''))
  .sort()

const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('[pageerror]', e.message))
await page.goto('http://localhost:5199/spike/')
await page.waitForFunction(() => document.getElementById('status')?.textContent === 'ready', null, { timeout: 60_000 })

mkdirSync(outDir, { recursive: true })
const summary = {}
for (const config of configs) {
  const results = await page.evaluate(([imgs, cfg]) => window.runSpike(imgs, cfg, true), [images, config])
  const dir = join(outDir, config.name)
  mkdirSync(dir, { recursive: true })
  summary[config.name] = {}
  for (const r of results) {
    writeFileSync(join(dir, `${r.image}.jpg`), Buffer.from(r.annotated.split(',')[1], 'base64'))
    summary[config.name][r.image] = { faces: r.detections.length, ms: Math.round(r.ms), detections: r.detections }
  }
  console.log(`✓ ${config.name}`)
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 1))

// 표로 출력: 이미지별 감지 수 (괄호는 ms)
const names = Object.keys(summary)
console.log(['image'.padEnd(26), ...names.map((n) => n.padStart(16))].join(''))
for (const img of images) {
  console.log([img.padEnd(26), ...names.map((n) => `${summary[n][img].faces} (${summary[n][img].ms}ms)`.padStart(16))].join(''))
}

await browser.close()
await server.close()
