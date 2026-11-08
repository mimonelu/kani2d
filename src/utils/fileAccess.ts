/** File System Access API のうち、TypeScript の型定義に含まれないもの */
interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
}

interface OpenFilePickerOptions {
  multiple?: boolean
  types?: FilePickerAcceptType[]
}

type ShowSaveFilePicker = (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
type ShowOpenFilePicker = (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>

type FilePickerWindow = Window & {
  showSaveFilePicker?: ShowSaveFilePicker
  showOpenFilePicker?: ShowOpenFilePicker
}

function getSaveFilePicker(): ShowSaveFilePicker | undefined {
  const picker = (window as FilePickerWindow).showSaveFilePicker
  return typeof picker === 'function' ? picker.bind(window) : undefined
}

function getOpenFilePicker(): ShowOpenFilePicker | undefined {
  const picker = (window as FilePickerWindow).showOpenFilePicker
  return typeof picker === 'function' ? picker.bind(window) : undefined
}

/** ブラウザのファイル保存ダイアログを使えるか（Chrome / Edge のみ対応） */
export function supportsSaveFilePicker(): boolean {
  return getSaveFilePicker() !== undefined
}

/** ブラウザのファイル選択ダイアログでファイルの書き込み先を得られるか（Chrome / Edge のみ対応） */
export function supportsOpenFilePicker(): boolean {
  return getOpenFilePicker() !== undefined
}

/** ダイアログがキャンセルされた場合は null を返す */
async function nullIfAborted<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

function acceptTypes(description: string, mimeType: string, extension: string): FilePickerAcceptType[] {
  return [{ description, accept: { [mimeType]: [extension] } }]
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
  return nullIfAborted(picker({ suggestedName, types: acceptTypes(description, mimeType, extension) }))
}

/** ブラウザのファイル選択ダイアログを開く。キャンセルされた場合は null を返す */
export async function pickOpenFile(
  description: string,
  mimeType: string,
  extension: string,
): Promise<FileSystemFileHandle | null> {
  const picker = getOpenFilePicker()
  if (!picker) throw new Error('Opening with a file dialog is not supported in this browser.')
  const handles = await nullIfAborted(picker({ types: acceptTypes(description, mimeType, extension) }))
  return handles?.[0] ?? null
}

/** ファイルの内容を置き換える。書き込みの許可が無い場合は、ブラウザがユーザーに許可を求める */
export async function writeFile(handle: FileSystemFileHandle, blob: Blob): Promise<void> {
  let writable: FileSystemWritableFileStream
  try {
    writable = await handle.createWritable()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      throw new Error('Permission to write to the file was not granted.')
    }
    throw error
  }
  try {
    await writable.write(blob)
    await writable.close()
  } catch (error) {
    // 書き込みに失敗した場合は元の内容を残す
    await writable.abort().catch(() => undefined)
    throw error
  }
}
