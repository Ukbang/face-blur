import { defineConfig, devices } from '@playwright/test'

const PORT = 5180
/** E2E_PREVIEW=1이면 개발 서버 대신 프로덕션 빌드(CSP 포함)로 테스트한다 */
const PREVIEW = !!process.env.E2E_PREVIEW
/** E2E_BASE_URL을 주면 서버를 띄우지 않고 그 주소(예: 배포된 사이트)를 테스트한다 */
const BASE_URL = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: BASE_URL ? undefined : {
    command: PREVIEW
      ? `npm run build && npx vite preview --port ${PORT} --strictPort`
      : `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI && !PREVIEW,
    timeout: 120_000,
  },
})
