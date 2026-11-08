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
  readonly tiles: TileMap
}

/** ドキュメントは不変として扱い、変更時は新しいオブジェクトを作る */
export interface Doc {
  /** 幅（マス） */
  readonly width: number
  /** 高さ（マス） */
  readonly height: number
  /** 背面から前面の順。先頭は常に背景レイヤー */
  readonly layers: readonly Layer[]
}

export interface Cell {
  readonly x: number
  readonly y: number
}
