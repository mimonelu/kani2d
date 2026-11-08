import { describe, expect, it } from 'vitest'
import { TOOLS, isTool, toolForKeyCode, toolTitle } from './tools'

describe('tools', () => {
  it('maps physical keys to tools', () => {
    expect(toolForKeyCode('KeyB')).toBe('draw')
    expect(toolForKeyCode('KeyE')).toBe('erase')
    expect(toolForKeyCode('KeyI')).toBe('pick')
    expect(toolForKeyCode('KeyV')).toBe('move')
    expect(toolForKeyCode('KeyH')).toBe('pan')
    expect(toolForKeyCode('KeyZ')).toBeUndefined()
  })

  it('shows the key and the temporary input in titles', () => {
    expect(TOOLS.map((info) => toolTitle(info, false))).toEqual([
      'Draw (B)',
      'Erase (E / Right click)',
      'Pick shape and color (I / Alt+click)',
      'Move layer (V / Ctrl+drag)',
      'Pan (H / Space+drag)',
    ])
    expect(TOOLS.map((info) => toolTitle(info, true))).toEqual([
      'Draw (B)',
      'Erase (E / Right click)',
      'Pick shape and color (I / Option+click)',
      'Move layer (V / ⌘+drag)',
      'Pan (H / Space+drag)',
    ])
  })

  it('validates tools', () => {
    expect(isTool('pan')).toBe(true)
    expect(isTool('move')).toBe(true)
    expect(isTool('fill')).toBe(false)
  })
})
