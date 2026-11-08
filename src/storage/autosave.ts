import { createStore, get, set } from 'idb-keyval'
import { watch } from 'vue'
import type { EditorStore } from '../store/editor'

const AUTOSAVE_DELAY = 500
const KEY = 'autosave'

let idbStore: ReturnType<typeof createStore> | null = null

function getIdbStore(): ReturnType<typeof createStore> {
  idbStore ??= createStore('kani2d', 'state')
  return idbStore
}

/** 保存済みの状態を復元し、以降の変更を自動保存する */
export async function setupAutosave(store: EditorStore): Promise<void> {
  try {
    const saved = await get(KEY, getIdbStore())
    if (saved !== undefined) store.restoreState(saved)
  } catch (error) {
    console.warn('Failed to restore the autosaved state.', error)
  }

  let timer: ReturnType<typeof setTimeout> | null = null

  const save = () => {
    timer = null
    set(KEY, store.exportState(), getIdbStore()).catch((error: unknown) => {
      console.warn('Failed to autosave.', error)
    })
  }

  const flush = () => {
    if (timer === null) return
    clearTimeout(timer)
    save()
  }

  watch(
    [store.doc, store.revision, store.docName, store.isDirty, store.selectedColor, store.activeLayerId],
    () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(save, AUTOSAVE_DELAY)
    },
  )

  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}
