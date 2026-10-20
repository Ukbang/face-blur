# 얼굴 블러

사진을 올리면 얼굴을 자동으로 찾아 블러 처리하는 웹앱이다. **사진은 서버로 전송되지 않는다.** 감지, 블러, 저장이 모두 브라우저 안에서 일어난다.

- 자동 감지: MediaPipe BlazeFace(full-range)에 이미지 피라미드 타일링을 더해 단체 사진의 작은 얼굴까지 찾는다
- 작은 얼굴 더 찾기: 군중 사진용 정밀 감지(타일을 더 잘게 쪼갠다)
- 수동 수정: 박스를 클릭하면 블러를 켜고 끈다. 빈 곳을 드래그하면 영역을 추가하고, 모서리로 크기를 조절하고, Del로 삭제한다
- 스타일: 블러, 모자이크, 검정, 이모지 × 타원·사각형 × 강도
- 저장: 원본 해상도와 원래 형식 그대로 저장한다. 캔버스로 다시 인코딩하므로 EXIF(GPS 등)는 남지 않는다

## 실행

```bash
npm install          # postinstall이 MediaPipe WASM을 public/mediapipe/로 복사한다
npm run dev          # http://localhost:5173
npm run build        # dist/ (CSP meta 포함)
```

## 테스트

```bash
npm test                         # 단위 테스트 (Vitest)
npm run test:e2e                 # E2E (Playwright, 개발 서버)
E2E_PREVIEW=1 npm run test:e2e   # E2E를 프로덕션 빌드 + CSP로
npx playwright install chromium  # 처음 한 번
```

E2E는 다음을 확인한다.
- 단체 사진 자동 감지
- 클릭/드래그/Delete 편집
- 스타일 4종
- 원본 크기 저장과 EXIF 제거
- **외부 요청과 업로드 요청이 0건인지**
- 효과가 박스 안 픽셀만 바꾸는지
- 정밀 감지 병합
- 모바일 레이아웃과 터치

## 구조

```
src/
  App.tsx                      상태(useReducer)와 감지 워커 연결, 붙여넣기·단축키
  state/editorReducer.ts       편집 상태와 액션
  components/                  UploadZone(첫 화면), Stage(캔버스 + SVG 편집), Panel(도구)
  lib/detector/
    mediapipe.ts               MediaPipe FaceDetector 래퍼
    tiling.ts                  피라미드 타일 분할 → 좌표 병합 → NMS, 이미지 크기별 타일 크기
    detect.worker.ts           감지 전용 Web Worker
    client.ts                  워커 요청/응답을 Promise로 감싼 클라이언트
  lib/effects/render.ts        블러/모자이크/검정/이모지 렌더링 (미리보기·저장 공용)
  lib/image/                   load(디코딩, EXIF 회전, 크기 제한), export(원본 해상도 저장)
  lib/faces.ts                 감지 박스 → 편집 영역 (여유 확장, 중복 제거)
spike/                         감지 모델 비교 실험 페이지 (개발 전용)
scripts/                       WASM 복사, 실험 이미지 다운로드, 실험 실행
docs/PLAN.md                   계획서
docs/SPIKE_RESULTS.md          감지 모델 실험 결과와 근거
```

## 개인정보 보호 설계

- 사진은 `File` → `<img>` 디코딩 → canvas로만 다룬다. 네트워크로 보내는 코드가 없다.
- 감지 모델(`public/models/`)과 WASM(`public/mediapipe/`), 폰트(`@fontsource`)를 모두 직접 호스팅한다. CDN을 호출하지 않는다.
- CSP `connect-src 'self'`로 브라우저 수준에서 외부 전송을 막는다. 빌드 결과에는 meta로, Vercel에는 `vercel.json` 헤더로 넣는다.

## 감지 실험 다시 돌리기

```bash
node scripts/fetch-spike-images.mjs   # Wikimedia Commons 자유 라이선스 사진 20장 (spike/images/SOURCES.md)
node scripts/spike-run.mjs            # 결과: spike/results/ (설정별 박스 이미지 + summary.json)
```
