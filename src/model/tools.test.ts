import { describe, expect, it } from 'vitest'
import { TOOLS, isTool, toolForKeyCode, toolTitle } from './tools'

describe('tools', () => {
  it('maps physical keys to tools', () => {
    expect(toolForKeyCode('KeyB')).toBe('draw')
    expect(toolForKeyCode('KeyE')).toBe('erase')
    expect(toolForKeyCode('KeyI')).toBe('pick')
    expect(toolForKeyCode('KeyH')).toBe('pan')
    expect(toolForKeyCode('KeyZ')).toBeUndefined()
  })

  it('shows the key and the temporary input in titles', () => {
    expect(TOOLS.map(toolTitle)).toEqual([
      'Draw (B)',
      'Erase (E / Right click)',
      'Pick shape and color (I / Alt+click)',
      'Pan (H / Space+drag)',
    ])
  })

  it('validates tools', () => {
    expect(isTool('pan')).toBe(true)
    expect(isTool('fill')).toBe(false)
  })
})
