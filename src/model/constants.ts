import type { ResizeAnchor } from './types'

export const APP_NAME = 'Kani2D'

export const BACKGROUND_LAYER_NAME = 'Background'
export const LAYER_NAME_PREFIX = 'Layer'
export const COPY_SUFFIX = 'copy'

export const DEFAULT_CANVAS_SIZE = 32
/** ガイドラインの間隔の初期値（マス） */
export const DEFAULT_GUIDE_SPACING = 16
/** ファイル名が無い場合に表示する文字列 */
export const UNNAMED_FILE_LABEL = 'undefined'
/** ファイル名が無い場合に保存・出力の候補として使う名前 */
export const FALLBACK_FILE_NAME = 'kani2d'

export const FILE_EXTENSION = '.ka2'
export const FILE_FORMAT_ID = 'kani2d'
export const FILE_FORMAT_VERSION = 3

export const HISTORY_LIMIT = 100

export const DEFAULT_TILE_SIZE = 32
export const TILE_SIZES: readonly number[] = [4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128]

export const DEFAULT_EXPORT_TILE_SIZE = 32
/** ブラウザの Canvas の上限を考慮した出力画像の最大辺 */
export const MAX_EXPORT_DIMENSION = 16384

/** リサイズの基準位置の初期値（中央） */
export const CENTER_ANCHOR: ResizeAnchor = { x: 0.5, y: 0.5 }
