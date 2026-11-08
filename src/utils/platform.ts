/** macOS か。修飾キーの判定と表示に使う */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
