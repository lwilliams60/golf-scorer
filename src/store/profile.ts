import type { Gender } from '../engine/types'

export interface Profile {
  id: string
  name: string
  handicapIndex: number
  gender: Gender
}

const PROFILE = 'golf:profile'
const ME = 'golf:me:'
const RECENT = 'golf:recent'

function get<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function put(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export const loadProfile = () => get<Profile | null>(PROFILE, null)
export const saveProfile = (p: Profile) => put(PROFILE, p)

/** Which player in a round is this device's user. */
export const myPlayerIn = (code: string) => get<string | null>(ME + code, null)
export const setMyPlayerIn = (code: string, pid: string) => {
  put(ME + code, pid)
  addRecent(code)
}

export interface RecentRound {
  code: string
  at: number
}
export const recentRounds = () => get<RecentRound[]>(RECENT, [])
export function addRecent(code: string) {
  const list = recentRounds().filter((r) => r.code !== code)
  list.unshift({ code, at: Date.now() })
  put(RECENT, list.slice(0, 50))
}
