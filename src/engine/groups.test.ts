import { describe, expect, it } from 'vitest'
import { expandGames, placeGroups } from './groups'

describe('placeGroups', () => {
  it('keeps the groups set at creation', () => {
    const g = placeGroups([{ id: 'g1', players: ['a', 'b'] }], [{ id: 'a' }, { id: 'b' }])
    expect(g).toEqual([{ id: 'g1', players: ['a', 'b'] }])
  })
  it('fills groups to four with players who join, in the order they joined', () => {
    const joiners = Array.from({ length: 19 }, (_, i) => ({ id: `p${i}`, joined: 100 + i }))
    const g = placeGroups([{ id: 'g1', players: ['org'] }], [{ id: 'org' }, ...joiners.reverse()])
    expect(g.map((x) => x.players.length)).toEqual([4, 4, 4, 4, 4])
    expect(g[0].players).toEqual(['org', 'p0', 'p1', 'p2'])
    expect(g[4].id).toBe('g5')
  })
  it('lets the organiser move a player to another group', () => {
    const g = placeGroups(
      [
        { id: 'g1', players: ['a', 'b'] },
        { id: 'g2', players: ['c'] },
      ],
      [{ id: 'a' }, { id: 'b', group: 'g2' }, { id: 'c' }],
    )
    expect(g).toEqual([
      { id: 'g1', players: ['a'] },
      { id: 'g2', players: ['c', 'b'] },
    ])
  })
  it('drops groups that end up empty', () => {
    const g = placeGroups([{ id: 'g1', players: ['a'] }], [{ id: 'a', group: 'g3' }])
    expect(g).toEqual([{ id: 'g3', players: ['a'] }])
  })
})

describe('expandGames', () => {
  const groups = [
    { id: 'g1', players: ['a', 'b', 'c', 'd'] },
    { id: 'g2', players: ['e', 'f', 'g'] },
  ]
  it('puts everyone in field games', () => {
    const [s] = expandGames([{ type: 'stableford', allowance: 1, stake: 1 }], groups)
    expect(s.players).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  })
  it('runs Wolf only in groups of four and Six Point only in groups of three', () => {
    const cfg = expandGames(
      [
        { type: 'wolf', allowance: 1, stake: 1 },
        { type: 'sixPoint', allowance: 1, stake: 1 },
      ],
      groups,
    )
    expect(cfg.map((c) => c.id)).toEqual(['wolf-g1', 'six-g2'])
  })
  it('keeps a match only while both players are in the round', () => {
    expect(expandGames([{ type: 'match', allowance: 1, stake: 5, pair: ['a', 'e'] }], groups)).toHaveLength(1)
    expect(expandGames([{ type: 'match', allowance: 1, stake: 5, pair: ['a', 'z'] }], groups)).toHaveLength(0)
  })
})
