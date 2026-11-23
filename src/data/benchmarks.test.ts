import { describe, expect, it } from 'vitest'
import { benchmarkFor, hcpLabel, playsLike, playsLikeLabel } from './benchmarks'

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

describe('playsLike', () => {
  it('reads handicaps back from the table', () => {
    expect(playsLike('gir', 0.5)).toBeCloseTo(3.24, 1)
    expect(playsLike('putts', 32.1)).toBeCloseTo(12.4, 1)
    expect(playsLike('toPar', 4.2)).toBeCloseTo(3.1, 1)
    expect(playsLike('scrambling', 0.46)).toBeCloseTo(0.83, 1)
  })
  it('clamps at scratch and 25', () => {
    expect(playsLike('gir', 0.8)).toBe(0)
    expect(playsLike('putts', 27)).toBe(0)
    expect(playsLike('gir', 0.05)).toBe(25)
    expect(playsLike('toPar', 40)).toBe(25)
  })
  it('labels', () => {
    expect(playsLikeLabel(0.2)).toBe('a scratch golfer')
    expect(playsLikeLabel(3.2)).toBe('a 3 hcp')
    expect(playsLikeLabel(11.4)).toBe('an 11 hcp')
    expect(playsLikeLabel(25)).toBe('a 25+ hcp')
  })
})
