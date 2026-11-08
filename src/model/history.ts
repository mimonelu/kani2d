export class History<T> {
  private readonly limit: number
  private undoStack: T[] = []
  private redoStack: T[] = []

  constructor(limit: number) {
    this.limit = limit
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** 変更前の状態を積む。やり直しの履歴は破棄する */
  push(entry: T): void {
    this.undoStack.push(entry)
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  undo(current: T): T | undefined {
    const entry = this.undoStack.pop()
    if (entry === undefined) return undefined
    this.redoStack.push(current)
    return entry
  }

  redo(current: T): T | undefined {
    const entry = this.redoStack.pop()
    if (entry === undefined) return undefined
    this.undoStack.push(current)
    return entry
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
