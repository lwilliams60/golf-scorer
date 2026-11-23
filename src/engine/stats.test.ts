import { describe, expect, it } from 'vitest'
import { focusAreas, holeFacts, summarise, type RoundFacts } from './stats'

const rf = (holes: ReturnType<typeof holeFacts>[]): RoundFacts => ({
  code: 'X', name: 'R', date: '2026-11-28', course: 'C',
  holesPlayed: holes.filter((h) => h.score != null).length,
  gross: holes.reduce((s, h) => s + (h.score ?? 0), 0),
  toPar: holes.reduce((s, h) => s + (h.score != null ? h.score - h.par : 0), 0),
  holes,
})

describe('hole facts', () => {
  it('works out GIR from score and putts when approach is not tapped', () => {
    expect(holeFacts(4, 4, { putts: 2 }).gir).toBe(true)
    expect(holeFacts(4, 5, { putts: 2 }).gir).toBe(false)
    expect(holeFacts(3, 3, { putts: 2 }).gir).toBe(true)
  })
  it('counts an up and down when the green is missed and par is made', () => {
    const f = holeFacts(4, 4, { approach: 'short', putts: 1 })
    expect(f.scrambleChance).toBe(true)
    expect(f.scrambled).toBe(true)
    expect(f.sandChance).toBe(false)
    expect(f.sg.around).toBeGreaterThan(0)
  })
  it('counts a sand save from a greenside bunker', () => {
    const made = holeFacts(4, 4, { approach: 'bunker', putts: 1 })
    expect(made.sandChance && made.sandSaved).toBe(true)
    const missed = holeFacts(4, 6, { approach: 'bunker', putts: 2 })
    expect(missed.sandChance).toBe(true)
    expect(missed.sandSaved).toBe(false)
  })
  it('estimates putting strokes gained from first-putt distance', () => {
    expect(holeFacts(4, 4, { approach: 'green', firstPutt: '20-40', putts: 1 }).sg.putting).toBeCloseTo(0.98)
    expect(holeFacts(4, 6, { approach: 'green', firstPutt: '3-10', putts: 3 }).sg.putting).toBeCloseTo(-1.6)
  })
  it('ignores tee shots on par 3s and reads old v1 fairway data', () => {
    expect(holeFacts(3, 3, { tee: 'left' }).tee).toBeNull()
    expect(holeFacts(4, 4, { fairway: 'hit' }).tee).toBe('fairway')
  })
  it('treats a pick-up as not played', () => {
    expect(holeFacts(4, 0, { putts: 2 }).score).toBeNull()
  })
})

describe('summary and focus', () => {
  const holes = [
    holeFacts(4, 5, { tee: 'right', approach: 'short', putts: 2 }),
    holeFacts(4, 5, { tee: 'right', approach: 'short', putts: 2 }),
    holeFacts(4, 4, { tee: 'fairway', approach: 'green', firstPutt: '10-20', putts: 2 }),
    holeFacts(3, 4, { approach: 'bunker', putts: 2 }),
    holeFacts(5, 7, { tee: 'left', approach: 'green', firstPutt: '20-40', putts: 3 }),
  ]
  const s = summarise([rf(holes)])
  it('summarises percentages', () => {
    expect(s.fairways).toBeCloseTo(0.25)
    expect(s.missRight).toBeCloseTo(2 / 3)
    expect(s.gir).toBeCloseTo(0.4)
    expect(s.scrambling).toBe(0)
    expect(s.sandSaves).toBe(0)
    expect(s.puttsPerGir).toBeCloseTo(2.5)
    expect(s.approachMiss.short).toBe(2)
  })
  it('picks the weakest areas first with a matching drill', () => {
    const f = focusAreas(s)
    expect(f.length).toBe(3)
    expect(f[0].sg).toBeLessThanOrEqual(f[1].sg)
    const tee = focusAreas({ ...s, sg: { tee: -5, approach: null, around: null, putting: null } })
    expect(tee[0].title).toMatch(/right/)
  })
  it('ranks against the handicap benchmark and skips areas where you are ahead', () => {
    const t = { ...s, fairways: 0.3, gir: 0.5, scrambling: 0.1, puttsPerRound: 30 }
    const f = focusAreas(t, 10)
    // around: (0.31-0.1)*9 = 1.9, tee: (0.49-0.3)*14*0.25 = 0.67; approach and putting are ahead of a 10
    expect(f.map((x) => x.area)).toEqual(['around', 'tee'])
    expect(f[0].body).toMatch(/^About 1\.9 shots a round behind a typical 10 hcp \(up and downs 10% v 31%\)/)
  })
  it('breaks approaches down by distance and names the weakest one', () => {
    const app = [
      ...[0, 1, 2].map(() => holeFacts(4, 4, { approach: 'green', approachDist: '100-125', putts: 2 })),
      holeFacts(4, 5, { approach: 'short', approachDist: '150-175', putts: 2 }),
      holeFacts(4, 5, { approach: 'short', approachDist: '150-175', putts: 2 }),
      holeFacts(4, 4, { approach: 'green', approachDist: '150-175', putts: 2 }),
    ]
    const a = summarise([rf(app)])
    const b = a.approachByBand.find((x) => x.band === '150-175')!
    expect(b).toMatchObject({ shots: 3, greens: 1, topMiss: 'short', topMissShare: 1 })
    const f = focusAreas({ ...a, sg: { tee: null, approach: -3, around: null, putting: null } })
    expect(f[0].title).toBe('Approaches from 150–175 yds')
    expect(f[0].body).toMatch(/1 of 3 greens hit, mostly missing short/)
  })
})
