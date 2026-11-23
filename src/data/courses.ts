import type { Course } from '../engine/types'
import newbury from './newbury-and-crookham.json'

export const BUILT_IN_COURSES: Course[] = [{ id: 'newbury-and-crookham', ...newbury } as Course]

const KEY = 'golf:courses'

export function savedCourses(): Course[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveCourse(c: Course) {
  const list = savedCourses().filter((x) => x.id !== c.id)
  list.unshift(c)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function allCourses(): Course[] {
  const saved = savedCourses()
  return [...saved, ...BUILT_IN_COURSES.filter((b) => !saved.some((s) => s.id === b.id))]
}

export function blankCourse(name: string): Course {
  const pars = [4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5]
  return {
    id: `custom-${Date.now()}`,
    name,
    holes: pars.map((p, i) => ({ n: i + 1, par_m: p, si_m: i + 1, par_w: p, si_w: i + 1 })),
    tees: [{ name: 'Yellow', yards: pars.map(() => 0), total: 0, ratings: { men: { par: 72, cr: 72, slope: 113 } } }],
  }
}
