import { describe, expect, it } from 'vitest'
import { toCourse } from './ukgolf'

const holes = (pars: number[], yd: number) => pars.map((p, i) => ({ hole_number: i + 1, par: p, stroke_index: ((i * 7) % 18) + 1, yardage: yd + i }))
const P = [4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5]

describe('UK Golf API mapping', () => {
  it('builds men and women cards and tees from tee sets', () => {
    const sets = [
      { name: 'Championship', colour: 'white', gender: 'male', par: 72, course_rating: 72.1, slope_rating: 131, total_yardage: 6500, holes: holes(P, 400) },
      { name: 'Medal', colour: 'yellow', gender: 'male', par: 72, course_rating: 70.2, slope_rating: 125, total_yardage: 6100, holes: holes(P, 370) },
      { name: 'Ladies', colour: 'red', gender: 'female', par: 74, course_rating: 73.5, slope_rating: 130, total_yardage: 5400, holes: holes(P.map((p) => (p === 4 ? 5 : p)), 300) },
    ]
    const c = toCourse('Test GC', 'Berkshire', { id: 'abc', name: 'Main' }, sets, false)!
    expect(c.id).toBe('uk-abc')
    expect(c.name).toBe('Test GC')
    expect(c.holes).toHaveLength(18)
    expect(c.holes[0]).toMatchObject({ n: 1, par_m: 4, par_w: 5 })
    expect(c.tees.map((t) => t.name)).toEqual(['White', 'Yellow', 'Red'])
    expect(c.tees[0].ratings.men).toEqual({ par: 72, cr: 72.1, slope: 131 })
    expect(c.tees[2].ratings.women).toEqual({ par: 74, cr: 73.5, slope: 130 })
    expect(c.tees[1].yards[0]).toBe(370)
  })
  it('skips courses without 18 holes or ratings', () => {
    expect(toCourse('X', '', { id: 1 }, [{ gender: 'M', holes: holes(P.slice(0, 9), 300), course_rating: 70, slope_rating: 120 }], false)).toBeNull()
    expect(toCourse('X', '', { id: 1 }, [{ gender: 'M', holes: holes(P, 300) }], false)).toBeNull()
  })
})
