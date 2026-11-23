import { describe, expect, it } from 'vitest'
import { benchmarkFor, hcpLabel } from './benchmarks'

describe('handicap benchmarks', () => {
  it('returns the published band exactly', () => {
    expect(benchmarkFor(10).gir).toBeCloseTo(0.36)
    expect(benchmarkFor(20).putts).toBeCloseTo(33.1)
  })
  it('blends between bands and clamps the ends', () => {
    expect(benchmarkFor(6).gir).toBeCloseTo(0.44 + (0.36 - 0.44) * 0.2)
    expect(benchmarkFor(-2).gir).toBeCloseTo(0.61)
    expect(benchmarkFor(36).gir).toBeCloseTo(0.1)
  })
  it('labels plus handicaps', () => {
    expect(hcpLabel(-1.5)).toBe('+1.5 hcp')
    expect(hcpLabel(6)).toBe('6 hcp')
  })
})
