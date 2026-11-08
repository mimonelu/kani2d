/** Lucide の pipette アイコン（ISC License）のパス */
const PIPETTE_PATHS = [
  'm12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12',
  'm18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z',
  'm2 22 .414-.414',
]

/** Lucide の paint-bucket アイコン（ISC License）のパス */
const PAINT_BUCKET_PATHS = [
  'M11 7 6 2',
  'M18.992 12H2.041',
  'M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595',
  'm8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33',
]

/** 24px 角のアイコンのパスから CSS の cursor の値を作る */
function createIconCursor(pathData: readonly string[], hotspotX: number, hotspotY: number, fallback: string): string {
  const paths = pathData.map((d) => `<path d="${d}"/>`).join('')
  // 背景の色によらず見えるよう、黒の縁取りを付けた白で描く
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    `<g stroke="#000" stroke-width="4">${paths}</g><g stroke="#fff" stroke-width="2">${paths}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, ${fallback}`
}

/** スポイトのカーソル。ホットスポットはスポイトの先端 */
export const PIPETTE_CURSOR = createIconCursor(PIPETTE_PATHS, 2, 22, 'copy')

/** 塗りつぶしのカーソル。ホットスポットは塗料のしずくの先端 */
export const PAINT_BUCKET_CURSOR = createIconCursor(PAINT_BUCKET_PATHS, 20, 22, 'crosshair')
