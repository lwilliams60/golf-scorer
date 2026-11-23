import { describe, expect, it } from 'vitest'
import courseJson from '../data/newbury-and-crookham.json'
import { courseHandicap, playingHandicap, strokesOnHole } from './handicap'
import { currentWolf, scoreGame, sixPointSplit, wolfFor } from './games'
import { moneyTotals, roundResults, settle } from './settle'
import type { Course, GameConfig, Player, Round } from './types'

const course: Course = { id: 'nc', ...courseJson } as Course

function mkPlayer(id: string, index: number, tee = 'Purple'): Player {
  return { id, name: id, handicapIndex: index, gender: 'm', tee }
}

function mkRound(players: Player[], games: GameConfig[], scores: Record<string, (number | null)[]> = {}): Round {
  return {
    id: 'r',
    code: 'ABCDEF',
    name: 'Test',
    date: '2026-11-28',
    course,
    players,
    groups: [{ id: 'g1', players: players.map((p) => p.id), scorer: null }],
    games,
    scores,
    teamScores: {},
    stats: {},
    wolf: {},
    createdBy: players[0].id,
    updatedAt: 0,
  }
}

const g = (type: GameConfig['type'], players: string[], extra: Partial<GameConfig> = {}): GameConfig => ({
  id: type,
  type,
  players,
  allowance: 1,
  stake: 0,
  ...extra,
})

/** Par for the men's card at Newbury & Crookham. */
const PARS = course.holes.map((h) => h.par_m)

describe('handicaps', () => {
  it('works out WHS course handicap from slope and rating', () => {
    expect(courseHandicap(course, mkPlayer('a', 18, 'Purple'))).toBe(19) // 18×122/113 − 0.7 = 18.73
    expect(courseHandicap(course, mkPlayer('a', 10, 'Black'))).toBe(12) // 10×130/113 + 0.3 = 11.80
    expect(courseHandicap(course, mkPlayer('a', 5, 'Silver'))).toBe(2) // 5×113/113 − 2.9 = 2.1
  })
  it('applies allowance', () => {
    expect(playingHandicap(course, mkPlayer('a', 18, 'Purple'), 0.95)).toBe(18) // 19 × 0.95 = 18.05
  })
  it('gives strokes by stroke index', () => {
    expect(strokesOnHole(14, 14)).toBe(1)
    expect(strokesOnHole(14, 15)).toBe(0)
    expect(strokesOnHole(20, 2)).toBe(2)
    expect(strokesOnHole(20, 3)).toBe(1)
    expect(strokesOnHole(-2, 18)).toBe(-1)
    expect(strokesOnHole(-2, 16)).toBe(0)
  })
})

describe('stableford', () => {
  it('scores 36 for net par on every hole', () => {
    const p = mkPlayer('a', 18, 'Purple') // PH 18 at 95%: one stroke a hole
    const r = mkRound([p], [g('stableford', ['a'], { allowance: 0.95 })], { a: PARS.map((x) => x + 1) })
    expect(scoreGame(r, r.games[0]).standings[0].value).toBe(36)
  })
  it('scores zero for a pick-up', () => {
    const p = mkPlayer('a', 0, 'Silver') // CH -3 at Silver: 0×1 − 2.9 → −3
    const scores = PARS.map(() => null as number | null)
    scores[0] = 0
    const r = mkRound([p], [g('stableford', ['a'])], { a: scores })
    expect(scoreGame(r, r.games[0]).standings[0].value).toBe(0)
  })
})

describe('six point', () => {
  it('splits 4-2-0', () => expect(sixPointSplit([4, 5, 6])).toEqual([4, 2, 0]))
  it('gives all 6 for winning by two clear', () => expect(sixPointSplit([3, 5, 6])).toEqual([6, 0, 0]))
  it('splits 3-3-0 on a tie for best', () => expect(sixPointSplit([4, 4, 5])).toEqual([3, 3, 0]))
  it('splits 4-1-1 on a tie for worst', () => expect(sixPointSplit([4, 5, 5])).toEqual([4, 1, 1]))
  it('gives all 6 when the others tie two behind', () => expect(sixPointSplit([4, 6, 6])).toEqual([6, 0, 0]))
  it('splits 2-2-2 on a three-way tie', () => expect(sixPointSplit([5, 5, 5])).toEqual([2, 2, 2]))
  it('keeps player order', () => expect(sixPointSplit([6, 4, 5])).toEqual([0, 4, 2]))
  it('treats a pick-up as worst', () => expect(sixPointSplit([4, Infinity, 5])).toEqual([4, 0, 2]))
  it('totals 6 points per hole over a round', () => {
    const ps = [mkPlayer('a', 10), mkPlayer('b', 15), mkPlayer('c', 20)]
    const r = mkRound(ps, [g('sixPoint', ['a', 'b', 'c'])], {
      a: PARS.map((x) => x + 1),
      b: PARS.map((x) => x + 1),
      c: PARS.map((x) => x + 2),
    })
    const res = scoreGame(r, r.games[0])
    expect(res.standings.reduce((s, x) => s + x.value, 0)).toBe(108)
  })
})

describe('match play', () => {
  it('reports a finished match as "x & y"', () => {
    const ps = [mkPlayer('a', 0, 'Silver'), mkPlayer('b', 0, 'Silver')]
    const a = PARS.map((x) => x - 1)
    const b = PARS.map((x) => x)
    const r = mkRound(ps, [g('match', ['a', 'b'])], { a, b })
    const res = scoreGame(r, r.games[0])
    expect(res.note).toContain('a wins 10 & 8')
  })
})

describe('skins', () => {
  it('carries tied holes over', () => {
    const ps = [mkPlayer('a', 0, 'Silver'), mkPlayer('b', 0, 'Silver')]
    const a: (number | null)[] = PARS.map(() => null)
    const b: (number | null)[] = PARS.map(() => null)
    ;[a[0], b[0]] = [4, 4]
    ;[a[1], b[1]] = [3, 4]
    const r = mkRound(ps, [g('skins', ['a', 'b'], { stake: 1 })], { a, b })
    const res = scoreGame(r, r.games[0])
    expect(res.standings[0]).toMatchObject({ id: 'a', value: 2 })
    expect(res.money).toEqual({ a: 2, b: -2 })
  })
})

describe('wolf', () => {
  const order = ['a', 'b', 'c', 'd']
  it('rotates the wolf, then gives 17 and 18 to last place', () => {
    expect(wolfFor(order, 0, {})).toBe('a')
    expect(wolfFor(order, 5, {})).toBe('b')
    expect(wolfFor(order, 16, { a: 5, b: 2, c: 3, d: 4 })).toBe('b')
  })
  it('scores team and lone wolf holes', () => {
    const ps = order.map((id) => mkPlayer(id, 0, 'Silver'))
    const blank = () => PARS.map(() => null as number | null)
    const s: Record<string, (number | null)[]> = { a: blank(), b: blank(), c: blank(), d: blank() }
    // Hole 1: a picks b, a+b win → 1 each
    s.a[0] = 3; s.b[0] = 5; s.c[0] = 4; s.d[0] = 4
    // Hole 2: b goes lone and wins → 4
    s.a[1] = 5; s.b[1] = 3; s.c[1] = 4; s.d[1] = 4
    // Hole 3: c goes lone and loses → 1 to each other
    s.a[2] = 3; s.b[2] = 4; s.c[2] = 4; s.d[2] = 4
    const game = g('wolf', order)
    const r = mkRound(ps, [game], s)
    r.wolf.wolf = [{ partner: 'b' }, { partner: null }, { partner: null }]
    const res = scoreGame(r, game)
    const pts = Object.fromEntries(res.standings.map((x) => [x.id, x.value]))
    expect(pts).toEqual({ a: 2, b: 6, c: 0, d: 1 })
    expect(currentWolf(r, game, 3)).toBe('d')
  })
})

describe('snake and settling up', () => {
  it('charges the last three-putter and settles with fewest payments', () => {
    const ps = ['a', 'b', 'c'].map((id) => mkPlayer(id, 0, 'Silver'))
    const game = g('snake', ['a', 'b', 'c'], { stake: 1, snakeGrowth: 1 })
    const r = mkRound(ps, [game])
    for (const p of ['a', 'b', 'c']) r.stats[p] = PARS.map(() => ({ putts: 2 }))
    r.stats.a[2].putts = 3
    r.stats.c[10].putts = 3
    const res = scoreGame(r, game)
    expect(res.note).toContain('c holds the snake')
    expect(res.money).toEqual({ a: 2, b: 2, c: -4 })
    const pay = settle(moneyTotals(roundResults(r)))
    expect(pay).toEqual([
      { from: 'c', to: 'a', amount: 2 },
      { from: 'c', to: 'b', amount: 2 },
    ])
  })
})
