import { useMemo, useState } from 'react'
import { go } from '../nav'
import { allCourses, saveCourse } from '../data/courses'
import { DEFAULT_ALLOWANCE, GAME_LABELS } from '../engine/games'
import type { Course, GameConfig, GameType, Gender } from '../engine/types'
import { setMyPlayerIn, type Profile } from '../store/profile'
import { key, newCode, newId, writeMany, type Setup, type StoredPlayer } from '../store/round'
import { CourseEditor } from './CourseEditor'

interface PRow {
  id: string
  name: string
  index: string
  gender: Gender
  tee: string
  group: number
  profileId?: string
}

interface GameOpt {
  on: boolean
  stake: string
  allowance: string
  extra?: string
  mode?: 'stableford' | 'match'
  a?: string
  b?: string
}

const FIELD_GAMES: GameType[] = ['stableford', 'stroke', 'skins', 'betterBall', 'wolf', 'sixPoint', 'snake', 'match', 'nassau', 'scramble']

const HELP: Partial<Record<GameType, string>> = {
  stableford: 'Points per hole on net score. Whole field.',
  stroke: 'Net strokes, lowest total wins. Money is per stroke.',
  skins: 'Outright best net score wins the skin; ties carry over.',
  betterBall: 'Pairs within each group (1st & 2nd v 3rd & 4th).',
  wolf: 'Each group of exactly 4.',
  sixPoint: 'Each group of exactly 3. Win by 2 clear takes all 6.',
  snake: 'Last to three-putt pays everyone. Players log their own putts.',
  match: 'Singles match between two players.',
  nassau: 'Front 9, back 9 and overall between two players.',
  scramble: 'Each group is a team and enters one score per hole.',
}

function chunkGroups(n: number): number[] {
  // Balanced groups of up to 4, e.g. 6 → 3+3, 7 → 4+3, 9 → 3+3+3.
  const groups = Math.ceil(n / 4)
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(Math.floor((i * groups) / n) + 1)
  return out
}

export function CreateRound({ profile }: { profile: Profile }) {
  const [courses, setCourses] = useState<Course[]>(allCourses)
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [editing, setEditing] = useState(false)
  const course = courses.find((c) => c.id === courseId)
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [date, setDate] = useState(today)
  const defaultTee = course?.tees[0]?.name ?? ''
  const [players, setPlayers] = useState<PRow[]>([
    { id: newId(), name: profile.name, index: String(profile.handicapIndex), gender: profile.gender, tee: defaultTee, group: 1, profileId: profile.id },
  ])
  const [autoGroups, setAutoGroups] = useState(true)
  const [games, setGames] = useState<Record<string, GameOpt>>(() =>
    Object.fromEntries(
      FIELD_GAMES.map((t) => [t, { on: t === 'stableford', stake: '', allowance: String(Math.round(DEFAULT_ALLOWANCE[t] * 100)), extra: t === 'snake' ? '0' : undefined, mode: 'stableford' }]),
    ),
  )
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    if (!autoGroups) return players
    const g = chunkGroups(players.length)
    return players.map((p, i) => ({ ...p, group: g[i] }))
  }, [players, autoGroups])

  const groupIds = [...new Set(rows.map((r) => r.group))].sort((a, b) => a - b)
  const groupSizes = groupIds.map((g) => rows.filter((r) => r.group === g).length)

  const upd = (id: string, patch: Partial<PRow>) => setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const updGame = (t: string, patch: Partial<GameOpt>) => setGames((gs) => ({ ...gs, [t]: { ...gs[t], ...patch } }))

  const valid = course && rows.length >= 1 && rows.length <= 32 && rows.every((r) => r.name.trim() && !Number.isNaN(Number(r.index)) && r.index !== '')

  async function create() {
    if (!course || !valid) return
    setBusy(true)
    const code = newCode()
    const groups = groupIds.map((g) => ({ id: `g${g}`, players: rows.filter((r) => r.group === g).map((r) => r.id) }))
    const all = rows.map((r) => r.id)
    const cfg: GameConfig[] = []
    const base = (t: GameType, o: GameOpt) => ({
      type: t,
      allowance: Number(o.allowance) / 100,
      stake: Number(o.stake) || 0,
    })
    for (const t of FIELD_GAMES) {
      const o = games[t]
      if (!o.on) continue
      const b = base(t, o)
      if (t === 'stableford' || t === 'stroke' || t === 'skins') cfg.push({ id: t, players: all, ...b })
      else if (t === 'snake') cfg.push({ id: t, players: all, ...b, snakeGrowth: Number(o.extra) || 0 })
      else if (t === 'wolf') groups.filter((g) => g.players.length === 4).forEach((g) => cfg.push({ id: `wolf-${g.id}`, players: g.players, ...b }))
      else if (t === 'sixPoint') groups.filter((g) => g.players.length === 3).forEach((g) => cfg.push({ id: `six-${g.id}`, players: g.players, ...b, sixPointSplit: '420' }))
      else if (t === 'scramble') cfg.push({ id: t, players: all, teams: groups.map((g) => g.players), ...b })
      else if (t === 'betterBall') {
        if (o.mode === 'match')
          groups
            .filter((g) => g.players.length === 4)
            .forEach((g) => cfg.push({ id: `bb-${g.id}`, players: g.players, teams: [g.players.slice(0, 2), g.players.slice(2)], betterBallMode: 'match', ...b }))
        else {
          const teams = groups.flatMap((g) => (g.players.length >= 2 ? [g.players.slice(0, 2), ...(g.players.length >= 4 ? [g.players.slice(2, 4)] : [])] : []))
          cfg.push({ id: 'bb', players: all, teams, betterBallMode: 'stableford', ...b })
        }
      } else if ((t === 'match' || t === 'nassau') && o.a && o.b && o.a !== o.b) cfg.push({ id: t, players: [o.a, o.b], ...b })
    }
    const setup: Setup = {
      name: name.trim() || `${course.name.replace(/ Golf Club$/, '')} ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      date,
      course,
      games: cfg,
      groups,
      createdBy: rows[0].id,
    }
    const entries: Record<string, unknown> = { [key.setup]: setup }
    for (const r of rows) {
      const p: StoredPlayer = { id: r.id, name: r.name.trim(), handicapIndex: Number(r.index), gender: r.gender, tee: r.tee || defaultTee }
      if (r.profileId) p.profileId = r.profileId
      entries[key.player(r.id)] = p
    }
    setMyPlayerIn(code, rows[0].id)
    await writeMany(code, entries)
    go(`round/${code}`)
  }

  if (editing)
    return (
      <CourseEditor
        onCancel={() => setEditing(false)}
        onSave={(c) => {
          saveCourse(c)
          setCourses(allCourses())
          setCourseId(c.id)
          setPlayers((ps) => ps.map((p) => ({ ...p, tee: c.tees[0].name })))
          setEditing(false)
        }}
        course={course && course.id.startsWith('custom') ? course : undefined}
      />
    )

  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={() => go('')}>
          ‹ Back
        </button>
        <h1>New round</h1>
      </header>
      <main className="pad">
        <h2>Course</h2>
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value)
            const c = courses.find((x) => x.id === e.target.value)
            if (c) setPlayers((ps) => ps.map((p) => ({ ...p, tee: c.tees[0].name })))
          }}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="link" onClick={() => setEditing(true)}>
          + Add a course by hand
        </button>
        <div className="row2">
          <label className="field">
            Round name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </label>
          <label className="field">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <h2>
          Players <span className="muted small">({rows.length}/32)</span>
        </h2>
        <p className="muted small">Tees can be changed on the first tee by each player.</p>
        {rows.map((r, i) => (
          <div className="prow" key={r.id}>
            <input className="pname" value={r.name} placeholder={`Player ${i + 1}`} onChange={(e) => upd(r.id, { name: e.target.value })} />
            <input className="pidx" inputMode="decimal" value={r.index} placeholder="H'cap" onChange={(e) => upd(r.id, { index: e.target.value })} />
            <select value={r.gender} onChange={(e) => upd(r.id, { gender: e.target.value as Gender })}>
              <option value="m">M</option>
              <option value="w">W</option>
            </select>
            <select value={r.tee} onChange={(e) => upd(r.id, { tee: e.target.value })}>
              {course?.tees.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
            {!autoGroups && (
              <select value={r.group} onChange={(e) => upd(r.id, { group: Number(e.target.value) })}>
                {Array.from({ length: 8 }, (_, k) => (
                  <option key={k} value={k + 1}>
                    G{k + 1}
                  </option>
                ))}
              </select>
            )}
            {i > 0 && (
              <button className="x" onClick={() => setPlayers((ps) => ps.filter((p) => p.id !== r.id))} aria-label="Remove">
                ×
              </button>
            )}
          </div>
        ))}
        {rows.length < 32 && (
          <button
            className="secondary"
            onClick={() =>
              setPlayers((ps) => [...ps, { id: newId(), name: '', index: '', gender: 'm', tee: defaultTee, group: Math.max(...ps.map((p) => p.group)) }])
            }
          >
            + Add player
          </button>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={!autoGroups}
            onChange={(e) => {
              if (e.target.checked) setPlayers(rows)
              setAutoGroups(!e.target.checked)
            }}
          />
          Choose groups myself
        </label>
        <p className="muted small">Groups: {groupSizes.map((s, i) => `G${groupIds[i]} (${s})`).join(', ')}</p>

        <h2>Games</h2>
        {FIELD_GAMES.map((t) => {
          const o = games[t]
          const hidden = (t === 'wolf' && !groupSizes.includes(4)) || (t === 'sixPoint' && !groupSizes.includes(3)) || ((t === 'match' || t === 'nassau') && rows.length < 2)
          if (hidden) return null
          return (
            <div className={`game ${o.on ? 'on' : ''}`} key={t}>
              <label className="check">
                <input type="checkbox" checked={o.on} onChange={(e) => updGame(t, { on: e.target.checked })} />
                <strong>{GAME_LABELS[t]}</strong>
              </label>
              <p className="muted small">{HELP[t]}</p>
              {o.on && (
                <div className="opts">
                  {t !== 'snake' && (
                    <label>
                      Allowance %
                      <input inputMode="numeric" value={o.allowance} onChange={(e) => updGame(t, { allowance: e.target.value })} />
                    </label>
                  )}
                  <label>
                    £ {t === 'skins' ? 'per skin' : t === 'match' || t === 'nassau' || t === 'scramble' ? 'per bet' : t === 'stroke' ? 'per stroke' : t === 'snake' ? 'snake' : 'per point'}
                    <input inputMode="decimal" value={o.stake} placeholder="0" onChange={(e) => updGame(t, { stake: e.target.value })} />
                  </label>
                  {t === 'snake' && (
                    <label>
                      + £ per 3-putt
                      <input inputMode="decimal" value={o.extra} onChange={(e) => updGame(t, { extra: e.target.value })} />
                    </label>
                  )}
                  {t === 'betterBall' && (
                    <label>
                      Format
                      <select value={o.mode} onChange={(e) => updGame(t, { mode: e.target.value as 'stableford' | 'match' })}>
                        <option value="stableford">Stableford</option>
                        <option value="match">Match play</option>
                      </select>
                    </label>
                  )}
                  {(t === 'match' || t === 'nassau') && (
                    <>
                      {(['a', 'b'] as const).map((side) => (
                        <label key={side}>
                          {side === 'a' ? 'Player' : 'v'}
                          <select value={o[side] ?? ''} onChange={(e) => updGame(t, { [side]: e.target.value })}>
                            <option value="">Pick</option>
                            {rows.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name || 'Unnamed'}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <button className="primary block" disabled={!valid || busy} onClick={create}>
          {busy ? 'Creating…' : 'Create round'}
        </button>
      </main>
    </div>
  )
}
