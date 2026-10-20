// 감지 실험용 테스트 이미지를 Wikimedia Commons에서 받는다.
// 이미지는 spike/images/에 저장하고 출처와 라이선스는 spike/images/SOURCES.md에 기록한다.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'spike/images')
const UA = 'blur-project-spike/0.1 (face-blur test set)'

// [저장 이름, 카테고리, Commons 파일 제목]
const IMAGES = [
  ['group-wikimania2016', '단체', 'File:Group photo of participants of Wikimania 2016 conference, Esino Lario,Italy.jpg'],
  ['group-wci2023', '단체', 'File:Participants - Wiki Conference India 2023 - Hyderabad 2023-04-30 8804.jpg'],
  ['group-solvay1927', '단체(흑백)', 'File:Solvay conference 1927.jpg'],
  ['group-bulgaria-football', '단체', 'File:Bulgarian national football team.JPG'],
  ['group-cornell-football', '단체(초소형 얼굴)', 'File:Cornell University football team 2017.jpg'],
  ['crowd-borough-market', '군중', 'File:View of crowds of people in Borough Market from Stoney Street - geograph.org.uk - 4677255.jpg'],
  ['crowd-eclipse-brill', '군중', 'File:Crowd of people witnessing the 2026 solar eclipse at Brill Windmill.jpg'],
  ['crowd-concert-cheltenham', '군중(관객)', 'File:Chamber Concert Audience, Cheltenham, Gloucestershire-geograph-4559749-by-Anthony-ONeil.jpg'],
  ['mask-copenhagen', '마스크', 'File:Women wearing face masks in Copenhagen (51087395881).jpg'],
  ['mask-hongkong', '마스크', 'File:Men in Hong Kong wearing Face mask in January 2020.jpg'],
  ['mask-madison', '마스크', 'File:Teens wearing face masks in Madison, Wisconsin 2020.jpg'],
  ['profile-jaipur', '옆얼굴', 'File:Side profile of Vaishnavi Chouhan in traditional Indian attire, Jaipur (2025).jpg'],
  ['profile-haber', '옆얼굴', 'File:CINvLOU 2018-04-07 - Daniel Haber (41600260562) (cropped).jpg'],
  ['sunglasses-two-girls', '선글라스', 'File:Two girls friends on holidays (14812706797).jpg'],
  ['friends-golf', '일반', 'File:DSC 6955 Three friends smiling on the golf course arms around each other after a great round.jpg'],
  ['night-buivien', '야간', 'File:Bui Vien Street, Ho Chi Minh City, at night, 2023 (01).jpg'],
  ['festival-calgary', '야외 관객', 'File:Calgary Folk Music Festival 2023 audience viewing main stage concert.jpg'],
  ['classroom-wikipedia', '교실', 'File:Reading Wikipedia in the Classroom for Secondary School Students 08.jpg'],
  ['selfie-beyoglu', '셀카', 'File:Group selfie, Beyoğlu 7May23.jpg'],
  ['noface-cat', '얼굴 없음(고양이)', 'File:Ulysses in Profile, A Contemplative Maine Coon Mix Portrait - Flickr - dalecruse.jpg'],
]

// Commons 표준 썸네일 폭. 원본이 이보다 크면 이 크기로 받는다.
const MAX_WIDTH = 3840

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 429(요청 과다)이면 Retry-After 또는 점점 길게 기다렸다가 다시 시도한다.
async function download(src) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(src, { headers: { 'User-Agent': UA } })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    if (res.status !== 429) throw new Error(`${res.status} ${src}`)
    const wait = Number(res.headers.get('retry-after')) * 1000 || 5000 * 2 ** attempt
    console.log(`  429 → ${wait / 1000}s 대기`)
    await sleep(wait)
  }
  throw new Error(`재시도 초과: ${src}`)
}

const stripHtml = (s = '') => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

async function info(title) {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'query', format: 'json', titles: title, prop: 'imageinfo',
    iiprop: 'url|size|extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist', iiurlwidth: String(MAX_WIDTH),
  })
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  const page = Object.values((await res.json()).query.pages)[0]
  if (!page.imageinfo) throw new Error(`없음: ${title}`)
  return page.imageinfo[0]
}

mkdirSync(outDir, { recursive: true })
const rows = []
for (const [name, category, title] of IMAGES) {
  const ii = await info(title)
  const src = ii.width > MAX_WIDTH ? ii.thumburl : ii.url
  const file = `${name}.jpg`
  const dest = join(outDir, file)
  if (!existsSync(dest)) {
    writeFileSync(dest, await download(src))
    await sleep(3000)
  }
  const lic = ii.extmetadata?.LicenseShortName?.value ?? '?'
  const artist = stripHtml(ii.extmetadata?.Artist?.value)
  rows.push(`| ${file} | ${category} | ${lic} | ${artist} | ${ii.descriptionurl} |`)
  console.log(`✓ ${file} (${lic})`)
}

writeFileSync(
  join(outDir, 'SOURCES.md'),
  ['# 테스트 이미지 출처', '', '모두 Wikimedia Commons의 자유 라이선스 이미지. 이미지 파일은 git에 넣지 않고 `node scripts/fetch-spike-images.mjs`로 다시 받는다.', '',
    '| 파일 | 분류 | 라이선스 | 저작자 | 출처 |', '|---|---|---|---|---|', ...rows, ''].join('\n'),
)
