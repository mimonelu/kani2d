export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // ダウンロード開始前に解放しないよう遅らせる
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
