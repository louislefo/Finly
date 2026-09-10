import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('combines class names correctly', () => {
    const result = cn('text-white', 'bg-zinc-950')
    expect(result).toBe('text-white bg-zinc-950')
  })

  it('handles conditional class names', () => {
    const isActive = true
    const isHidden = false
    const result = cn(
      'base-class',
      isActive && 'active-class',
      isHidden && 'hidden-class'
    )
    expect(result).toBe('base-class active-class')
  })

  it('merges Tailwind conflicts properly using twMerge', () => {
    const result = cn('p-4', 'p-2', 'text-red-500', 'text-blue-500')
    expect(result).toBe('p-2 text-blue-500')
  })
})
