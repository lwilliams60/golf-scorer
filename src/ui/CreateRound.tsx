import { useEffect, useMemo, useState } from 'react'
import { go } from '../nav'
import { addToLibrary, allCourses, loadLibrary } from '../data/courses'
import { CoursePicker, CourseReview } from './CoursePicker'
import { DEFAULT_ALLOWANCE, GAME_LABELS } from '../engine/games'
import { TeeSelect } from './TeeSelect'
import type { Course, GameType, Gender } from '../engine/types'
import { setMyPlayerIn, type Profile } from '../store/profile'
import { expandGames, type GameTemplate } from '../engine/groups'
import { key, newCode, newId, writeMany, type Setup, type StoredPlayer } from '../store/round'
import { CourseEditor } from './CourseEditor'
import { GAME_RULES } from '../data/gameRules'

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

function RulesPanel({ type }: { type: GameType }) {
  const r = GAME_RULES[type]
  return (
    <div className="rules">
      <p className="rules-sum">{r.summary}</p>
      <h4>How it works</h4>
      <ul>
        {r.howItWorks.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h4>Handicaps</h4>
      <p>{r.handicaps}</p>
      <h4>If you can't finish a hole</h4>
      <p>{r.pickUp}</p>
      <h4>Money</h4>
      <p>{r.money}</p>
    </div>
  )
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
  // No default course: the player chooses or searches every time.
  const [courseId, setCourseId] = useState('')
  // null = closed, 'new' = blank card, a Course = editing that card
  const [editing, setEditing] = useState<Course | 'new' | null>(null)
  const [reviewing, setReviewing] = useState<Course | null>(null)
  const course = courses.find((c) => c.id === courseId)
  useEffect(() => {
    loadLibrary().then(setCourses)
  }, [])
  function chooseCourse(c: Course) {
    setCourses((cs) => [c, ...cs.filter((x) => x.id !== c.id)])
    setCourseId(c.id)
    setPlayers((ps) => ps.map((p) => ({ ...p, tee: c.tees[0].name })))
  }
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [date, setDate] = useState(today)
  const defaultTee = course?.tees[0]?.name ?? ''
  const [players, setPlayers] = useState<PRow[]>([
    { id: newId(), name: profile.name, index: String(profile.handicapIndex), gender: profile.gender, tee: defaultTee, group: 1, profileId: profile.id },
  ])
  const [autoGroups, setAutoGroups] = useState(true)
  const [rulesOpen, setRulesOpen] = useState<GameType | null>(null)
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
    const templates: GameTemplate[] = []
    for (const t of FIELD_GAMES) {
      const o = games[t]
      if (!o.on) continue
      const tp: GameTemplate = { type: t, allowance: Number(o.allowance) / 100, stake: Number(o.stake) || 0 }
      if (t === 'snake') tp.snakeGrowth = Number(o.extra) || 0
      if (t === 'betterBall') tp.betterBallMode = o.mode === 'match' ? 'match' : 'stableford'
      if (t === 'match' || t === 'nassau') {
        if (!o.a || !o.b || o.a === o.b) continue
        tp.pair = [o.a, o.b]
      }
      templates.push(tp)
    }
    const cfg = expandGames(templates, groups)
    const setup: Setup = {
      name: name.trim() || `${course.name.replace(/ Golf Club$/, '')} ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      date,
      course,
      games: cfg,
      templates,
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
        onCancel={() => setEditing(null)}
        onSave={(c) => {
          addToLibrary(c)
          chooseCourse(c)
          setEditing(null)
          setReviewing(null)
        }}
        course={editing === 'new' ? undefined : editing}
      />
    )
  if (reviewing)
    return (
      <CourseReview
        course={reviewing}
        onCancel={() => setReviewing(null)}
        onFix={() => setEditing(reviewing)}
        onUse={() => {
          addToLibrary(reviewing)
          chooseCourse(reviewing)
          setReviewing(null)
        }}
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
        <CoursePicker courses={courses} selected={course} onPick={chooseCourse} onCheck={setReviewing} onAddByHand={() => setEditing('new')} />
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
          <div className="pcard" key={r.id}>
            <div className="pcard-top">
              <input className="pname" aria-label="Name" value={r.name} placeholder={`Player ${i + 1}`} onChange={(e) => upd(r.id, { name: e.target.value })} />
              {i > 0 && (
                <button className="x" onClick={() => setPlayers((ps) => ps.filter((p) => p.id !== r.id))} aria-label="Remove">
                  ×
                </button>
              )}
            </div>
            <div className={`pcard-row ${autoGroups ? '' : 'withgroup'}`}>
              <label>
                <span>Handicap</span>
                <input inputMode="decimal" value={r.index} placeholder="14.2" onChange={(e) => upd(r.id, { index: e.target.value })} />
              </label>
              <label>
                <span>Tees</span>
                {course ? (
                  <TeeSelect course={course} tee={r.tee} gender={r.gender} onChange={(tee, gender) => upd(r.id, { tee, gender })} />
                ) : (
                  <select disabled aria-label="Tees">
                    <option>Choose a course first</option>
                  </select>
                )}
              </label>
              {!autoGroups && (
                <label>
                  <span>Group</span>
                  <select value={r.group} onChange={(e) => upd(r.id, { group: Number(e.target.value) })}>
                    {Array.from({ length: 8 }, (_, k) => (
                      <option key={k} value={k + 1}>
                        G{k + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
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
        <p className="muted small join-hint">
          Big group? Just add yourself and create the round. Everyone else joins with the code or invite link, adds themselves from their own phone, and
          is put into groups of four. You can move people between groups after.
        </p>
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
              <div className="game-head">
                <label className="check">
                  <input type="checkbox" checked={o.on} onChange={(e) => updGame(t, { on: e.target.checked })} />
                  <strong>{GAME_LABELS[t]}</strong>
                </label>
                <button
                  type="button"
                  className={`info-btn ${rulesOpen === t ? 'on' : ''}`}
                  aria-expanded={rulesOpen === t}
                  aria-label={`How ${GAME_LABELS[t]} works`}
                  onClick={() => setRulesOpen(rulesOpen === t ? null : t)}
                >
                  i
                </button>
              </div>
              <p className="muted small">{HELP[t]}</p>
              {rulesOpen === t && <RulesPanel type={t} />}
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
        {!course && <p className="muted small">Choose a course at the top to create the round.</p>}
        <button className="primary block" disabled={!valid || busy} onClick={create}>
          {busy ? 'Creating…' : 'Create round'}
        </button>
      </main>
    </div>
  )
}
