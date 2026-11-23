import { useCallback, useEffect, useRef, useState } from 'react'
import type { Course, GameConfig, HoleStats, Player, Round, WolfChoice } from '../engine/types'
import { backend, localBackend, type Entries } from './backend'

export interface Setup {
  name: string
  date: string
  course: Course
  games: GameConfig[]
  groups: { id: string; players: string[] }[]
  createdBy: string
}

export type StoredPlayer = Player & { profileId?: string }

export const key = {
  setup: 'setup',
  player: (pid: string) => `p|${pid}`,
  score: (pid: string, i: number) => `s|${pid}|${i}`,
  team: (team: string, i: number) => `t|${team}|${i}`,
  stat: (pid: string, i: number) => `st|${pid}|${i}`,
  wolf: (gid: string, i: number) => `w|${gid}|${i}`,
  scorer: (gid: string) => `scorer|${gid}`,
}

export function assemble(code: string, e: Entries): Round | null {
  const setup = e[key.setup] as Setup | undefined
  if (!setup) return null
  const players: StoredPlayer[] = []
  const scores: Round['scores'] = {}
  const teamScores: Round['teamScores'] = {}
  const stats: Round['stats'] = {}
  const wolf: Round['wolf'] = {}
  const scorers: Record<string, string | null> = {}
  const n = setup.course.holes.length
  const arr = <T,>(m: Record<string, T[]>, id: string, fill: T) => (m[id] ??= Array.from({ length: n }, () => fill))
  for (const [k, v] of Object.entries(e)) {
    const [kind, a, b] = k.split('|')
    const i = Number(b)
    if (kind === 'p') players.push(v as StoredPlayer)
    else if (kind === 's') arr(scores, a, null as number | null)[i] = v as number | null
    else if (kind === 't') arr(teamScores, a, null as number | null)[i] = v as number | null
    else if (kind === 'st') arr(stats, a, {} as HoleStats)[i] = v as HoleStats
    else if (kind === 'w') arr(wolf, a, null as WolfChoice | null)[i] = v as WolfChoice | null
    else if (kind === 'scorer') scorers[a] = v as string | null
  }
  const order = setup.groups.flatMap((g) => g.players)
  players.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id))
  return {
    id: code,
    code,
    name: setup.name,
    date: setup.date,
    course: setup.course,
    players,
    groups: setup.groups.map((g) => ({ ...g, scorer: scorers[g.id] ?? null })),
    games: setup.games,
    scores,
    teamScores,
    stats,
    wolf,
    createdBy: setup.createdBy,
    updatedAt: Date.now(),
  }
}

// ---------- Offline write queue ----------
interface QueuedWrite {
  code: string
  k: string
  v: unknown
}
const QUEUE_KEY = 'golf:queue'

function readQueue(): QueuedWrite[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}
function writeQueue(q: QueuedWrite[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    /* ignore */
  }
}

let flushing = false
export async function flushQueue(): Promise<number> {
  if (flushing) return readQueue().length
  flushing = true
  try {
    let q = readQueue()
    while (q.length) {
      const w = q[0]
      try {
        await backend.upsert(w.code, w.k, w.v)
      } catch {
        break
      }
      // Only drop the write we just sent. If the player tapped again while it was in flight,
      // the newer value is still queued and goes next.
      q = readQueue()
      const i = q.findIndex((x) => x.code === w.code && x.k === w.k && JSON.stringify(x.v) === JSON.stringify(w.v))
      if (i >= 0) q.splice(i, 1)
      writeQueue(q)
    }
    return q.length
  } finally {
    flushing = false
  }
}

export async function write(code: string, k: string, v: unknown) {
  // Always keep a local copy so the round works with no signal.
  if (backend.kind !== 'local') await localBackend.upsert(code, k, v)
  const q = readQueue().filter((w) => !(w.code === code && w.k === k))
  q.push({ code, k, v })
  writeQueue(q)
  await flushQueue()
}

export async function writeMany(code: string, entries: Entries) {
  for (const [k, v] of Object.entries(entries)) await write(code, k, v)
}

export function pendingCount() {
  return readQueue().length
}

// ---------- React hook ----------
export function useRound(code: string) {
  const [entries, setEntries] = useState<Entries | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'offline'>('loading')
  const [pending, setPending] = useState(pendingCount())
  const ref = useRef<Entries>({})

  useEffect(() => {
    let alive = true
    const apply = (k: string, v: unknown) => {
      // A live update can echo an older value while this phone still has a newer one waiting to send.
      if (readQueue().some((w) => w.code === code && w.k === k)) return
      ref.current = { ...ref.current, [k]: v }
      setEntries(ref.current)
    }
    ;(async () => {
      const cached = await localBackend.load(code)
      if (cached && alive) {
        ref.current = cached
        setEntries(cached)
        setStatus('ready')
      }
      try {
        const remote = await backend.load(code)
        if (!alive) return
        if (remote) {
          // Keep local writes that haven't reached the server yet.
          const mine = Object.fromEntries(readQueue().filter((w) => w.code === code).map((w) => [w.k, w.v]))
          ref.current = { ...ref.current, ...remote, ...mine }
          setEntries(ref.current)
          setStatus('ready')
          if (backend.kind !== 'local') for (const [k, v] of Object.entries(remote)) await localBackend.upsert(code, k, v)
        } else if (!cached) setStatus('missing')
      } catch {
        if (alive) setStatus(cached ? 'offline' : 'missing')
      }
    })()
    let unsub = backend.subscribe(code, apply)
    const unsubLocal = backend.kind === 'local' ? () => {} : localBackend.subscribe(code, apply)
    // Safety net for when a phone sleeps or loses signal and misses live updates:
    // re-read the round from the server and reconnect the live feed.
    const refresh = async () => {
      if (backend.kind === 'local') return
      try {
        const remote = await backend.load(code)
        if (!alive || !remote) return
        const mine = Object.fromEntries(readQueue().filter((w) => w.code === code).map((w) => [w.k, w.v]))
        ref.current = { ...ref.current, ...remote, ...mine }
        setEntries(ref.current)
        setStatus('ready')
      } catch {
        /* offline; try again next time */
      }
    }
    let ticks = 0
    const tick = setInterval(async () => {
      setPending(await flushQueue())
      if (++ticks % 4 === 0) refresh()
    }, 5000)
    const wake = async () => {
      if (document.visibilityState !== 'visible') return
      setPending(await flushQueue())
      unsub()
      unsub = backend.subscribe(code, apply)
      refresh()
    }
    const online = async () => {
      setPending(await flushQueue())
      refresh()
    }
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', wake)
    return () => {
      alive = false
      unsub()
      unsubLocal()
      clearInterval(tick)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [code])

  const set = useCallback(
    async (k: string, v: unknown) => {
      ref.current = { ...ref.current, [k]: v }
      setEntries(ref.current)
      await write(code, k, v)
      setPending(pendingCount())
    },
    [code],
  )

  const round = entries ? assemble(code, entries) : null
  return { round, status, set, pending }
}

export function newCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  const rnd = crypto.getRandomValues(new Uint32Array(6))
  for (const x of rnd) s += alphabet[x % alphabet.length]
  return s
}

export function newId(): string {
  return crypto.randomUUID().slice(0, 8)
}
