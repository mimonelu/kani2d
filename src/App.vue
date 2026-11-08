<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import AppToolbar from './components/AppToolbar.vue'
import ColorPalette from './components/ColorPalette.vue'
import DialogModal from './components/DialogModal.vue'
import EditorCanvas from './components/EditorCanvas.vue'
import ExportModal from './components/ExportModal.vue'
import LayerList from './components/LayerList.vue'
import ResizeModal from './components/ResizeModal.vue'
import { FILE_EXTENSION } from './model/constants'
import { FileFormatError } from './model/fileFormat'
import { editor } from './store/editor'
import { isEditableTarget } from './utils/dom'
import { downloadBlob } from './utils/download'

interface Dialog {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm?: () => void
}

const { docName, isDirty } = editor

const showResize = ref(false)
const showExport = ref(false)
const dialog = shallowRef<Dialog | null>(null)
const fileInput = ref<HTMLInputElement>()

const modalOpen = computed(() => showResize.value || showExport.value || dialog.value !== null)

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
  confirmDiscard(() => editor.newDocument())
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
  } catch (error) {
    dialog.value = {
      title: 'Failed to load the file',
      message: error instanceof FileFormatError ? error.message : 'The file could not be read.',
    }
  }
}

function onSave() {
  const blob = new Blob([editor.serialize()], { type: 'application/json' })
  downloadBlob(blob, `${docName.value}${FILE_EXTENSION}`)
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
    <ResizeModal v-if="showResize" @close="showResize = false" />
    <ExportModal v-if="showExport" @close="showExport = false" />
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
