import { describe, expect, it } from 'vitest'
import { holeFacts, summarise, type RoundFacts } from './stats'
import { approachTip, puttingTip, shortGameTip, statsView, teeTip } from './statsView'
import type { HoleStats } from './types'

function round(stats: HoleStats[], scores: number[], pars: number[], date = '2026-11-01'): RoundFacts {
  const holes = pars.map((p, i) => holeFacts(p, scores[i], stats[i]))
  const gross = scores.reduce((a, b) => a + b, 0)
  return { code: date, name: '', date, course: 'Test', holesPlayed: holes.length, gross, toPar: gross - pars.reduce((a, b) => a + b, 0), holes }
}

const pars = [4, 4, 3, 4, 5, 4, 3, 4, 4, 4, 4, 3, 4, 5, 4, 3, 4, 5]

describe('statsView', () => {
  const tees: HoleStats[] = pars.map((p, i) => (p === 3 ? {} : { tee: i % 3 === 0 ? 'left' : i % 5 === 0 ? 'right' : 'fairway' }))
  const r = round(tees, pars.map((p, i) => p + (i % 4 === 0 ? 1 : 0)), pars)
  const v = statsView([r])

  it('counts drives by where they finished', () => {
    expect(v.tee.total).toBe(14)
    expect(v.tee.left + v.tee.right + v.tee.fairway).toBe(14)
  })
  it('counts how holes finish', () => {
    expect(v.finish.pars + v.finish.bogeys).toBe(18)
    expect(v.finish.bogeys).toBe(5)
  })
  it('lists full rounds oldest first for the trend', () => {
    const later = round(tees, pars, pars, '2026-11-20')
    expect(statsView([later, r]).trend.map((t) => t.toPar)).toEqual([5, 0])
  })
  it('spots a one-sided tee miss', () => {
    const left: HoleStats[] = pars.map((p, i) => (p === 3 ? {} : { tee: i % 2 ? 'left' : 'fairway' }))
    const rr = round(left, pars, pars)
    expect(teeTip(statsView([rr]), summarise([rr]), 10)?.title).toMatch(/miss left/)
  })
  it('names the distance where approaches come up short', () => {
    const st: HoleStats[] = pars.map(() => ({ approach: 'short', approachDist: '150-175' }))
    const rr = round(st, pars.map((p) => p + 1), pars)
    expect(approachTip(statsView([rr]), summarise([rr]), 6)?.title).toBe('From 150–175 yards, most misses come up short.')
  })
  it('flags bunkers when sand saves trail the typical figure', () => {
    const st: HoleStats[] = pars.map((_, i) => (i < 6 ? { approach: 'bunker', putts: 2 } : { approach: 'short', putts: 1 }))
    const rr = round(st, pars.map((p, i) => (i < 6 ? p + 1 : p)), pars)
    expect(shortGameTip(statsView([rr]), 6)?.title).toBe('Bunkers are the weak spot.')
  })
  it('suggests lag putting when long putts lead to three-putts', () => {
    const st: HoleStats[] = pars.map((_, i) => (i < 6 ? { putts: 3, firstPutt: '40+' } : { putts: 2, firstPutt: '10-20' }))
    const rr = round(st, pars.map((p, i) => (i < 6 ? p + 1 : p)), pars)
    expect(puttingTip(summarise([rr]), 6)?.title).toBe('Lag putting is the quick win.')
  })
})
