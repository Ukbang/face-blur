import { devices, expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FIXTURE = fileURLToPath(new URL('../fixtures/solvay1927.jpg', import.meta.url))
/** E2E_PREVIEW=1이면 빌드 결과로 돌고, 소스 모듈을 직접 import하는 테스트는 건너뛴다 */
const PREVIEW = !!process.env.E2E_PREVIEW || !!process.env.E2E_BASE_URL
/** 지정하면 화면 확인용 스크린샷을 남긴다 */
const SHOTS = process.env.SCREENSHOT_DIR

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

async function openFixture(page: Page) {
  await page.goto('/')
  await expect(page.getByText('감지 모델 준비 완료')).toBeVisible({ timeout: 60_000 })
  if (SHOTS) {
    await page.waitForTimeout(1200) // 등장 애니메이션이 끝난 뒤
    await shot(page, '01-landing')
  }
  await page.setInputFiles('[data-testid=file-input]', FIXTURE)
  await expect(page.locator('.scan')).toBeHidden({ timeout: 60_000 })
  await expect(page.locator('.face')).not.toHaveCount(0)
}

/** JPEG SOF 마커에서 가로·세로를 읽는다 (페이지 안에서 디코딩하면 CSP에 막힌다) */
function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2
  while (i < buf.length) {
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  throw new Error('JPEG 크기를 찾지 못했습니다')
}

/** "N / M개 가리는 중"에서 N */
async function enabledCount(page: Page) {
  return Number(await page.locator('.stat strong').innerText())
}

test('업로드하면 단체 사진의 얼굴을 자동으로 찾는다', async ({ page }) => {
  await openFixture(page)
  await shot(page, '02-editor')
  // 원본 해상도 실험에서는 29/29. 1600px로 줄인 픽스처에서도 대부분 찾아야 한다.
  expect(await page.locator('.face').count()).toBeGreaterThanOrEqual(25)
  expect(await enabledCount(page)).toBe(await page.locator('.face').count())
})

test('박스 클릭으로 블러를 끄고, 빈 곳 드래그로 영역을 추가한다', async ({ page }) => {
  await openFixture(page)
  const before = await enabledCount(page)
  const total = await page.locator('.face').count()

  await page.locator('.face').first().click()
  await expect(page.locator('.face.off')).toHaveCount(1)
  expect(await enabledCount(page)).toBe(before - 1)

  // 하늘/벽 쪽 빈 공간(이미지 왼쪽 위 구석)에 드래그로 새 영역 추가
  const box = (await page.locator('.overlay').boundingBox())!
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + 70, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('.face')).toHaveCount(total + 1)
  await shot(page, '03-edited')

  // 선택된(방금 만든) 영역을 Delete로 삭제
  await page.keyboard.press('Delete')
  await expect(page.locator('.face')).toHaveCount(total)
})

test('스타일을 바꿔도 동작하고, 원본 크기로 저장되며 EXIF가 없다', async ({ page }) => {
  await openFixture(page)
  for (const label of ['모자이크', '검정', '이모지', '블러']) {
    await page.getByRole('radio', { name: label }).click()
    await expect(page.getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true')
    await shot(page, `04-style-${label}`)
  }

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '저장하기' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('solvay1927-blurred.jpg')

  const bytes = readFileSync((await download.path())!)
  expect(bytes.includes(Buffer.from('Exif\0\0'))).toBe(false)
  expect(jpegSize(bytes)).toEqual({ width: 1600, height: 1158 })
})

test('사진은 어디에도 업로드되지 않는다', async ({ page }) => {
  const requests: { method: string; url: string }[] = []
  page.on('request', (r) => requests.push({ method: r.method(), url: r.url() }))
  await openFixture(page)
  await page.getByRole('button', { name: '저장하기' }).click()

  const appHost = new URL(page.url()).hostname
  const external = requests.filter((r) => !r.url.startsWith('data:') && !r.url.startsWith('blob:') && new URL(r.url).hostname !== appHost)
  expect(external).toEqual([])
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([])
})

test('작은 얼굴 더 찾기는 기존 영역을 지우지 않고 새 영역만 더한다', async ({ page }) => {
  await openFixture(page)
  await page.locator('.face').first().click() // 하나는 사용자가 해제한 상태로
  const before = await page.locator('.face').count()

  await page.getByRole('button', { name: '작은 얼굴 더 찾기' }).click()
  await expect(page.getByRole('button', { name: '정밀 감지 완료' })).toBeDisabled({ timeout: 60_000 })
  expect(await page.locator('.face').count()).toBeGreaterThanOrEqual(before)
  // 해제한 영역이 정밀 감지로 다시 켜지거나 중복 추가되지 않는다
  await expect(page.locator('.face.off')).toHaveCount(1)
})

test('효과는 박스 안 픽셀만 바꾸고 박스 밖은 그대로 둔다', async ({ page }) => {
  test.skip(PREVIEW, '소스 모듈을 직접 불러오는 테스트라 개발 서버에서만 돈다')
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { renderScene } = await import('/src/lib/effects/render.ts')
    // 무작위 노이즈 원본
    const src = document.createElement('canvas')
    src.width = 200
    src.height = 200
    const sctx = src.getContext('2d')!
    const noise = sctx.createImageData(200, 200)
    for (let i = 0; i < noise.data.length; i++) noise.data[i] = i % 4 === 3 ? 255 : Math.random() * 255
    sctx.putImageData(noise, 0, 0)

    const face = { id: 'a', x: 50, y: 50, width: 100, height: 100, enabled: true, source: 'manual' as const }
    const out: Record<string, { inside: number; outside: number }> = {}
    for (const style of ['blur', 'mosaic', 'box', 'emoji'] as const) {
      const dst = document.createElement('canvas')
      dst.width = 200
      dst.height = 200
      const ctx = dst.getContext('2d')!
      renderScene(ctx, src, 200, 200, [face], { style, shape: 'rect', strength: 0, emoji: '🙂' })
      const a = sctx.getImageData(0, 0, 200, 200).data
      const b = ctx.getImageData(0, 0, 200, 200).data
      let inside = 0
      let outside = 0
      let nIn = 0
      let nOut = 0
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          const i = (y * 200 + x) * 4
          const diff = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
          const isIn = x >= 52 && x < 148 && y >= 52 && y < 148
          const isOut = x < 48 || x >= 152 || y < 48 || y >= 152
          if (isIn) {
            inside += diff
            nIn++
          } else if (isOut) {
            outside += diff
            nOut++
          }
        }
      }
      out[style] = { inside: inside / nIn, outside: outside / nOut }
    }
    return out
  })
  for (const [style, { inside, outside }] of Object.entries(result)) {
    expect(outside, `${style}: 박스 밖`).toBeLessThan(1)
    expect(inside, `${style}: 박스 안`).toBeGreaterThan(30)
  }
})

test.describe('모바일', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...pixel } = devices['Pixel 7']
  test.use(pixel)

  test('가로 스크롤 없이 보이고, 탭으로 블러를 끌 수 있다', async ({ page }) => {
    await openFixture(page)
    await shot(page, '05-mobile-editor')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    const before = await enabledCount(page)
    await page.locator('.face').first().tap()
    await expect(page.locator('.face.off')).toHaveCount(1)
    expect(await enabledCount(page)).toBe(before - 1)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await shot(page, '06-mobile-panel')
  })
})
