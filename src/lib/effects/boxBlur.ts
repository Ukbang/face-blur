/**
 * RGBA 픽셀 배열에 분리형 박스 블러를 radius 크기로 passes번 적용한다 (3번이면 가우시안에 가깝다).
 * 블러는 아주 작게 줄인 얼굴 영역에만 쓰므로 단순 구현으로 충분하다. 가장자리는 끝 픽셀을 늘려 쓴다.
 */
export function boxBlur(data: Uint8ClampedArray, width: number, height: number, radius: number, passes = 3): void {
  if (radius < 1 || width < 1 || height < 1) return
  const tmp = new Uint8ClampedArray(data.length)
  for (let p = 0; p < passes; p++) {
    blurAxis(data, tmp, width, height, radius, true)
    blurAxis(tmp, data, width, height, radius, false)
  }
}

function blurAxis(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const len = horizontal ? width : height
  const lines = horizontal ? height : width
  const size = radius * 2 + 1
  const idx = (line: number, i: number) => {
    const c = Math.min(len - 1, Math.max(0, i))
    return (horizontal ? line * width + c : c * width + line) * 4
  }
  for (let line = 0; line < lines; line++) {
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0
      for (let i = -radius; i <= radius; i++) sum += src[idx(line, i) + ch]
      for (let i = 0; i < len; i++) {
        dst[idx(line, i) + ch] = sum / size
        sum += src[idx(line, i + radius + 1) + ch] - src[idx(line, i - radius) + ch]
      }
    }
  }
}
