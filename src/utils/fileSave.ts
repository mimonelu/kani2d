/** File System Access API のうち、TypeScript の型定義に含まれないもの */
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}

type ShowSaveFilePicker = (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>

function getSaveFilePicker(): ShowSaveFilePicker | undefined {
  const picker = (window as Window & { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker
  return typeof picker === 'function' ? picker.bind(window) : undefined
}

/** ブラウザのファイル保存ダイアログを使えるか（Chrome / Edge のみ対応） */
export function supportsSaveFilePicker(): boolean {
  return getSaveFilePicker() !== undefined
}

/** ブラウザのファイル保存ダイアログを開く。キャンセルされた場合は null を返す */
export async function pickSaveFile(
  suggestedName: string,
  description: string,
  mimeType: string,
  extension: string,
): Promise<FileSystemFileHandle | null> {
  const picker = getSaveFilePicker()
  if (!picker) throw new Error('Saving with a file dialog is not supported in this browser.')
  try {
    return await picker({ suggestedName, types: [{ description, accept: { [mimeType]: [extension] } }] })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

/** ファイルの内容を置き換える */
export async function writeFile(handle: FileSystemFileHandle, blob: Blob): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(blob)
    await writable.close()
  } catch (error) {
    // 書き込みに失敗した場合は元の内容を残す
    await writable.abort().catch(() => undefined)
    throw error
  }
}
