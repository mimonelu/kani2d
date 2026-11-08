/** Lucide の pipette アイコン（ISC License）のパス */
const PIPETTE_PATHS = [
  'm12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12',
  'm18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z',
  'm2 22 .414-.414',
]

function createPipetteCursor(): string {
  const paths = PIPETTE_PATHS.map((d) => `<path d="${d}"/>`).join('')
  // 背景の色によらず見えるよう、黒の縁取りを付けた白で描く
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    `<g stroke="#000" stroke-width="4">${paths}</g><g stroke="#fff" stroke-width="2">${paths}</g></svg>`
  // ホットスポットはスポイトの先端
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 22, copy`
}

/** スポイトのカーソル（CSS の cursor の値） */
export const PIPETTE_CURSOR = createPipetteCursor()
