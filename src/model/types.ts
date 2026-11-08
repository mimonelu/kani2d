/** タイルの形状。三角形は直角の頂点がある角で表す */
export const Shape = {
  Square: 0,
  TopLeft: 1,
  TopRight: 2,
  BottomRight: 3,
  BottomLeft: 4,
} as const

export type Shape = (typeof Shape)[keyof typeof Shape]

export const SHAPE_COUNT = 5

/** ローテーションと形状の選択の並び順 */
export const SHAPE_ORDER: readonly Shape[] = [
  Shape.Square,
  Shape.BottomRight,
  Shape.BottomLeft,
  Shape.TopLeft,
  Shape.TopRight,
]

export interface Tile {
  readonly x: number
  readonly y: number
  /** `#RRGGBB` 形式（大文字） */
  readonly color: string
  readonly shape: Shape
}

/** タイルは `tileKey(x, y)` をキーとする疎なマップで持つ */
export type TileMap = Map<string, Tile>

export interface Layer {
  /** エディタ内でのみ使う識別子。ファイルには保存しない */
  readonly id: string
  readonly name: string
  /** 非表示のレイヤーはエディタ上で描画せず、出力にも含めない */
  readonly visible: boolean
  readonly tiles: TileMap
}

/** ガイドラインの間隔（マス） */
export interface GuideSpacing {
  readonly width: number
  readonly height: number
}

/** ドキュメントは不変として扱い、変更時は新しいオブジェクトを作る */
export interface Doc {
  /** 幅（マス） */
  readonly width: number
  /** 高さ（マス） */
  readonly height: number
  /** キャンバスの左上を起点とする */
  readonly guideSpacing: GuideSpacing
  /** 背面から前面の順。先頭は常に背景レイヤー */
  readonly layers: readonly Layer[]
}

export interface Cell {
  readonly x: number
  readonly y: number
}

/** マス単位の矩形 */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** リサイズの基準位置の各軸の値。0 は左（上）、0.5 は中央、1 は右（下） */
export type AnchorPosition = 0 | 0.5 | 1

/** リサイズの基準位置 */
export interface ResizeAnchor {
  readonly x: AnchorPosition
  readonly y: AnchorPosition
}
