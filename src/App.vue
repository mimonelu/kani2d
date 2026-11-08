<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import AppToolbar from './components/AppToolbar.vue'
import ColorPalette from './components/ColorPalette.vue'
import DialogModal from './components/DialogModal.vue'
import EditorCanvas from './components/EditorCanvas.vue'
import ExportModal from './components/ExportModal.vue'
import LayerList from './components/LayerList.vue'
import NewModal from './components/NewModal.vue'
import ResizeModal from './components/ResizeModal.vue'
import SaveAsModal from './components/SaveAsModal.vue'
import { FALLBACK_FILE_NAME, FILE_EXTENSION } from './model/constants'
import { FileFormatError, normalizeFileName } from './model/fileFormat'
import { editor } from './store/editor'
import { isEditableTarget } from './utils/dom'
import { downloadBlob } from './utils/download'
import { pickSaveFile, supportsSaveFilePicker, writeFile } from './utils/fileSave'

const FILE_MIME_TYPE = 'application/json'

interface Dialog {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm?: () => void
}

const { docName, isDirty } = editor

const showNew = ref(false)
const showResize = ref(false)
const showExport = ref(false)
const showSaveAs = ref(false)
const dialog = shallowRef<Dialog | null>(null)
const fileInput = ref<HTMLInputElement>()
const saving = ref(false)

const modalOpen = computed(
  () => showNew.value || showResize.value || showExport.value || showSaveAs.value || dialog.value !== null,
)

/** ファイル保存ダイアログで選ばれたファイル。以降のセーブはこのファイルに上書きする */
let saveHandle: FileSystemFileHandle | null = null
/** 新規作成・ロードで増える。非同期のセーブ中にドキュメントが置き換わったかの判定に使う */
let session = 0

/** 新規作成・ロードでドキュメントを置き換えた後に呼ぶ */
function startSession() {
  session++
  saveHandle = null
}

/** ファイルへの未保存の変更があれば破棄してよいか確認してから実行する */
function confirmDiscard(action: () => void) {
  if (!isDirty.value) {
    action()
    return
  }
  dialog.value = {
    title: 'Discard changes?',
    message: 'The current drawing has unsaved changes. They will be lost.',
    confirmLabel: 'Discard',
    cancelLabel: 'Cancel',
    danger: true,
    onConfirm: action,
  }
}

function onDialogConfirm() {
  const current = dialog.value
  dialog.value = null
  // ファイル選択はユーザー操作の中で開く必要があるため、同期的に実行する
  current?.onConfirm?.()
}

function onNew() {
  confirmDiscard(() => {
    showNew.value = true
  })
}

function onCreate(name: string | undefined, width: number, height: number) {
  showNew.value = false
  editor.newDocument(name, width, height)
  startSession()
}

function onLoad() {
  confirmDiscard(() => fileInput.value?.click())
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    editor.loadFile(await file.text(), file.name)
    startSession()
  } catch (error) {
    dialog.value = {
      title: 'Failed to load the file',
      message: error instanceof FileFormatError ? error.message : 'The file could not be read.',
    }
  }
}

function createFileBlob(): Blob {
  return new Blob([editor.serialize()], { type: FILE_MIME_TYPE })
}

/**
 * - ファイル保存ダイアログで選んだファイルがあれば、そのファイルに上書きする
 * - ファイル名があればダウンロードする
 * - ファイル名が無ければファイル保存ダイアログを開く。非対応のブラウザではアプリ内のモーダルでファイル名を入力させる
 */
async function onSave() {
  if (saving.value) return
  if (!saveHandle && docName.value === undefined && !supportsSaveFilePicker()) {
    showSaveAs.value = true
    return
  }
  // 保存処理中の編集を未保存の変更として扱うため、この時点のドキュメントを記録する
  const savingDoc = editor.doc.value
  const blob = createFileBlob()
  const current = session
  saving.value = true
  try {
    if (saveHandle) {
      await writeFile(saveHandle, blob)
    } else if (docName.value !== undefined) {
      downloadBlob(blob, `${docName.value}${FILE_EXTENSION}`)
    } else {
      // ダイアログはユーザー操作の中で開く必要があるため、await より前に呼び出す
      const handle = await pickSaveFile(
        `${FALLBACK_FILE_NAME}${FILE_EXTENSION}`,
        'Kani2D file',
        FILE_MIME_TYPE,
        FILE_EXTENSION,
      )
      if (!handle) return
      await writeFile(handle, blob)
      if (current !== session) return
      saveHandle = handle
      editor.setDocName(normalizeFileName(handle.name))
    }
    if (current === session) editor.markSaved(savingDoc)
  } catch (error) {
    dialog.value = {
      title: 'Failed to save the file',
      message: error instanceof Error && error.message ? error.message : 'The file could not be saved.',
    }
  } finally {
    saving.value = false
  }
}

function onSaveAs(name: string) {
  showSaveAs.value = false
  editor.setDocName(name)
  downloadBlob(createFileBlob(), `${name}${FILE_EXTENSION}`)
  editor.markSaved()
}

function onKeyDown(event: KeyboardEvent) {
  if (modalOpen.value || isEditableTarget(event.target)) return
  const modifier = event.ctrlKey || event.metaKey
  if (!modifier || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      editor.redo()
    } else {
      editor.undo()
    }
  } else if (key === 'y' && event.ctrlKey && !event.shiftKey) {
    event.preventDefault()
    editor.redo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="app">
    <AppToolbar
      @new="onNew"
      @resize="showResize = true"
      @load="onLoad"
      @save="onSave"
      @export="showExport = true"
    />
    <main class="workspace">
      <EditorCanvas class="workspace__canvas" :locked="modalOpen" />
      <aside class="workspace__sidebar">
        <LayerList />
        <ColorPalette />
      </aside>
    </main>
    <input
      ref="fileInput"
      class="file-input"
      type="file"
      :accept="`${FILE_EXTENSION},application/json`"
      tabindex="-1"
      aria-hidden="true"
      @change="onFileChosen"
    />
    <NewModal v-if="showNew" @close="showNew = false" @create="onCreate" />
    <ResizeModal v-if="showResize" @close="showResize = false" />
    <ExportModal v-if="showExport" @close="showExport = false" />
    <SaveAsModal v-if="showSaveAs" @close="showSaveAs = false" @save="onSaveAs" />
    <DialogModal
      v-if="dialog"
      :title="dialog.title"
      :message="dialog.message"
      :confirm-label="dialog.confirmLabel"
      :cancel-label="dialog.cancelLabel"
      :danger="dialog.danger"
      @confirm="onDialogConfirm"
      @cancel="dialog = null"
    />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  user-select: none;
}

.workspace {
  display: flex;
  flex: 1;
  min-height: 0;
}

.workspace__canvas {
  flex: 1;
  min-width: 0;
}

.workspace__sidebar {
  display: flex;
  flex: none;
  flex-direction: column;
  width: var(--sidebar-width);
  border-left: 1px solid var(--color-border);
  background: var(--color-panel);
}

.file-input {
  display: none;
}
</style>
