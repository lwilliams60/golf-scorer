import { backend } from '../store/backend'
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

// ---------- Shared course library (everyone's saved courses, stored in the database) ----------
const LIBRARY = 'library'

/** Courses anyone in the app has added, plus this phone's and the built-in ones. */
export async function loadLibrary(): Promise<Course[]> {
  let shared: Course[] = []
  try {
    const e = await backend.load(LIBRARY)
    shared = Object.values(e ?? {}).filter((c): c is Course => !!c && typeof c === 'object' && 'holes' in (c as object))
  } catch {
    /* offline: this phone's courses only */
  }
  const local = allCourses()
  return [...local, ...shared.filter((s) => !local.some((l) => l.id === s.id))]
}

/** Saves a course on this phone and in the shared library so everyone can find it. */
export async function addToLibrary(c: Course) {
  saveCourse(c)
  try {
    await backend.upsert(LIBRARY, c.id, c)
  } catch {
    /* saved on this phone; shared next time */
  }
}

export interface UkClub {
  id: string
  name: string
  place: string
}

export async function searchUk(q: string): Promise<UkClub[]> {
  const r = await fetch(`/api/courses?q=${encodeURIComponent(q)}`)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Course search is not available')
  return j.clubs ?? []
}

export async function fetchUkClub(id: string): Promise<{ courses: Course[]; skipped: string[] }> {
  const r = await fetch(`/api/courses?club=${encodeURIComponent(id)}`)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Could not load that club')
  return { courses: j.courses ?? [], skipped: j.skipped ?? [] }
}
