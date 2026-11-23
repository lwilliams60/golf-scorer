import { backend } from './backend'
import { focusAreas, summarise, type Focus, type Summary } from '../engine/stats'
import type { MyRound } from './history'
import type { Profile } from './profile'

export interface CoachRound {
  date: string
  course: string
  name: string
  gross: number
  toPar: number
  holesPlayed: number
  points: number
  /** Per hole: par, score, tee, approach, first putt, putts. Compact so the link stays fast. */
  holes: { par: number; score: number | null; tee: string | null; approach: string | null; firstPutt: string | null; putts: number | null }[]
}

export interface CoachReport {
  v: 1
  player: string
  handicapIndex: number
  createdAt: string
  summary: Summary
  stableford: number | null
  focus: Focus[]
  rounds: CoachRound[]
}

const SHARES = 'golf:shares'
export const SHARE_ROUNDS = 6

function token() {
  const a = new Uint8Array(12)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('')
}

export function buildReport(profile: Profile, mine: MyRound[]): CoachReport {
  const last = mine.slice(0, SHARE_ROUNDS)
  const summary = summarise(last.map((m) => m.facts))
  const full = last.filter((m) => m.facts.holesPlayed === 18)
  return {
    v: 1,
    player: profile.name,
    handicapIndex: profile.handicapIndex,
    createdAt: new Date().toISOString(),
    summary,
    stableford: full.length ? full.reduce((s, m) => s + m.points, 0) / full.length : null,
    focus: focusAreas(summary),
    rounds: last.map((m) => ({
      date: m.round.date,
      course: m.round.course.name,
      name: m.round.name,
      gross: m.facts.gross,
      toPar: m.facts.toPar,
      holesPlayed: m.facts.holesPlayed,
      points: m.points,
      holes: m.facts.holes.map((h) => ({ par: h.par, score: h.score, tee: h.tee, approach: h.approach, firstPutt: h.firstPutt, putts: h.putts })),
    })),
  }
}

export interface ShareLink {
  token: string
  createdAt: string
}

export function myShares(): ShareLink[] {
  try {
    return JSON.parse(localStorage.getItem(SHARES) ?? '[]')
  } catch {
    return []
  }
}

function saveShares(list: ShareLink[]) {
  try {
    localStorage.setItem(SHARES, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export const coachUrl = (t: string) => `${location.origin}${location.pathname}#coach/${t}`

/** Saves a snapshot of the report under a private, unguessable link. */
export async function createShare(report: CoachReport): Promise<string> {
  const t = token()
  await backend.upsert(`share:${t}`, 'report', report)
  saveShares([{ token: t, createdAt: report.createdAt }, ...myShares()])
  return t
}

/** Turns a link off: the coach sees "this link has been switched off". */
export async function revokeShare(t: string) {
  await backend.upsert(`share:${t}`, 'report', null)
  saveShares(myShares().filter((s) => s.token !== t))
}

export async function loadShare(t: string): Promise<CoachReport | null | 'revoked'> {
  const e = await backend.load(`share:${t}`)
  if (!e) return null
  return (e.report as CoachReport | null) ?? 'revoked'
}
