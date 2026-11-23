import { useMemo, useState } from 'react'
import { go } from '../nav'
import { courseHandicap, holePar, holeSI, playingHandicap, strokesOnHole, teeFor } from '../engine/handicap'
import { currentWolf } from '../engine/games'
import { moneyTotals, roundResults, settle } from '../engine/settle'
import type { FairwayResult, HoleStats, Player, Round, WolfChoice } from '../engine/types'
import { backend } from '../store/backend'
import { key, useRound } from '../store/round'
import { myPlayerIn, type Profile } from '../store/profile'

type Tab = 'card' | 'board' | 'settle'

export function RoundScreen({ code, profile }: { code: string; profile: Profile }) {
  const { round, status, set, pending } = useRound(code)
  const [tab, setTab] = useState<Tab>('card')
  const me = myPlayerIn(code)

  if (status === 'loading' && !round) return <Shell title="Loading…" />
  if (!round) return <Shell title="Round not found">{status === 'missing' && <p className="pad">Check the code and try again.</p>}</Shell>
  if (!me || !round.players.some((p) => p.id === me))
    return (
      <Shell title={round.name}>
        <div className="pad">
          <p>You're not in this round on this phone yet.</p>
          <button className="primary block" onClick={() => go(`join/${code}`)}>
            Pick your name
          </button>
        </div>
      </Shell>
    )

  async function share() {
    const url = `${location.origin}${location.pathname}#join/${code}`
    const text = `Join our round "${round!.name}" with code ${code}: ${url}`
    try {
      if (navigator.share) await navigator.share({ title: 'Golf round', text, url })
      else {
        await navigator.clipboard.writeText(text)
        alert('Link copied')
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={() => go('')}>
          ‹ Home
        </button>
        <div className="title">
          <h1>{round.name}</h1>
          <span className="muted small">
            {round.course.name} ·{' '}
            <button className="code-btn" onClick={share}>
              {code} ⇪
            </button>
          </span>
        </div>
        <span className={`sync ${pending ? 'waiting' : ''}`} title={backend.kind === 'local' ? 'Test mode' : pending ? 'Waiting for signal' : 'Synced'}>
          {backend.kind === 'local' ? 'Test' : pending ? `${pending}↑` : '●'}
        </span>
      </header>
      <nav className="tabs">
        {(['card', 'board', 'settle'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'card' ? 'Scorecard' : t === 'board' ? 'Leaderboard' : 'Settle up'}
          </button>
        ))}
      </nav>
      {tab === 'card' && <Scorecard round={round} me={me} set={set} profile={profile} />}
      {tab === 'board' && <Board round={round} />}
      {tab === 'settle' && <Settle round={round} />}
    </div>
  )
}

function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={() => go('')}>
          ‹ Home
        </button>
        <h1>{title}</h1>
      </header>
      {children}
    </div>
  )
}

// ---------------- Scorecard ----------------
function firstOpenHole(round: Round, players: string[]) {
  const n = round.course.holes.length
  for (let i = 0; i < n; i++) if (players.some((p) => round.scores[p]?.[i] == null)) return i
  return n - 1
}

function Scorecard({ round, me, set }: { round: Round; me: string; set: (k: string, v: unknown) => Promise<void>; profile: Profile }) {
  const myGroup = round.groups.find((g) => g.players.includes(me)) ?? round.groups[0]
  const [groupId, setGroupId] = useState(myGroup.id)
  const group = round.groups.find((g) => g.id === groupId) ?? myGroup
  const [hole, setHole] = useState(() => firstOpenHole(round, group.players))
  const h = round.course.holes[hole]
  const n = round.course.holes.length
  const byId = (id: string) => round.players.find((p) => p.id === id)!
  const meP = byId(me)
  const scorer = group.scorer
  const canScore = (pid: string) => (scorer ? scorer === me : pid === me)
  const mainAllowance = round.games.find((g) => g.type !== 'snake')?.allowance ?? 1

  const wolfGame = round.games.find((g) => g.type === 'wolf' && g.players.every((p) => group.players.includes(p)))
  const scrambleTeam = round.games.find((g) => g.type === 'scramble')?.teams?.find((t) => t.join('+') === group.players.join('+'))
  const myStats: HoleStats = round.stats[me]?.[hole] ?? {}
  const setStat = (patch: Partial<HoleStats>) => set(key.stat(me, hole), { ...myStats, ...patch })

  return (
    <main className="pad card">
      {round.groups.length > 1 && (
        <select className="groupsel" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {round.groups.map((g, i) => (
            <option key={g.id} value={g.id}>
              Group {i + 1}: {g.players.map((p) => byId(p).name).join(', ')}
            </option>
          ))}
        </select>
      )}
      <div className="holestrip">
        {round.course.holes.map((x, i) => {
          const done = group.players.every((p) => round.scores[p]?.[i] != null)
          return (
            <button key={i} className={`${i === hole ? 'on' : ''} ${done ? 'done' : ''}`} onClick={() => setHole(i)}>
              {x.n}
            </button>
          )
        })}
      </div>
      <div className="holehead">
        <button className="nav" disabled={hole === 0} onClick={() => setHole(hole - 1)}>
          ‹
        </button>
        <div>
          <div className="holeno">Hole {h.n}</div>
          <div className="muted">
            Par {holePar(h, meP)} · SI {holeSI(h, meP)} · {teeFor(round.course, meP).yards[hole] || '–'} yds ({meP.tee})
          </div>
        </div>
        <button className="nav" disabled={hole === n - 1} onClick={() => setHole(hole + 1)}>
          ›
        </button>
      </div>

      {group.players.includes(me) && (
        <div className="scorerbar">
          Scoring:
          <select value={scorer ?? ''} onChange={(e) => set(key.scorer(group.id), e.target.value || null)}>
            <option value="">Everyone scores themselves</option>
            {group.players.map((p) => (
              <option key={p} value={p}>
                {byId(p).name} scores for the group
              </option>
            ))}
          </select>
        </div>
      )}

      {wolfGame && <WolfPicker round={round} game={wolfGame} hole={hole} byId={byId} set={set} />}

      {scrambleTeam ? (
        <div className="prow-score">
          <div>
            <strong>Team score</strong>
            <div className="muted small">{scrambleTeam.map((p) => byId(p).name).join(' & ')}</div>
          </div>
          <Stepper
            value={round.teamScores[scrambleTeam.join('+')]?.[hole] ?? null}
            par={h.par_m}
            disabled={!group.players.includes(me)}
            onChange={(v) => set(key.team(scrambleTeam.join('+'), hole), v)}
          />
        </div>
      ) : null}

      {group.players.map((pid) => {
        const p = byId(pid)
        const ph = playingHandicap(round.course, p, mainAllowance)
        const strokes = strokesOnHole(ph, holeSI(h, p), n)
        const v = round.scores[pid]?.[hole] ?? null
        return (
          <div className={`prow-score ${pid === me ? 'me' : ''}`} key={pid}>
            <div>
              <strong>{p.name}</strong> {strokes > 0 && <span className="dots">{'●'.repeat(strokes)}</span>}
              {strokes < 0 && <span className="dots plus">+{-strokes}</span>}
              <div className="muted small">
                PH {ph} · {p.tee}
                {v != null && v > 0 && ` · net ${v - strokes}`}
              </div>
            </div>
            <Stepper value={v} par={holePar(h, p)} disabled={!canScore(pid)} onChange={(nv) => set(key.score(pid, hole), nv)} />
          </div>
        )
      })}
      {scorer && scorer !== me && <p className="muted small">{byId(scorer).name} is scoring for this group. You can still log your own stats below.</p>}

      {group.players.includes(me) && (
        <section className="stats">
          <h3>My stats</h3>
          {holePar(h, meP) > 3 && (
            <div className="statrow">
              <span>Fairway</span>
              <div className="seg">
                {(['left', 'hit', 'right'] as FairwayResult[]).map((f) => (
                  <button key={f} className={myStats.fairway === f ? 'on' : ''} onClick={() => setStat({ fairway: myStats.fairway === f ? undefined : f })}>
                    {f === 'left' ? '← Left' : f === 'hit' ? 'Hit' : 'Right →'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="statrow">
            <span>Green in reg</span>
            <div className="seg">
              {[true, false].map((b) => (
                <button key={String(b)} className={myStats.gir === b ? 'on' : ''} onClick={() => setStat({ gir: myStats.gir === b ? undefined : b })}>
                  {b ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>
          <div className="statrow">
            <span>Putts</span>
            <MiniStepper value={myStats.putts} start={2} onChange={(x) => setStat({ putts: x })} />
          </div>
          <div className="statrow">
            <span>Penalties</span>
            <MiniStepper value={myStats.penalties} start={1} onChange={(x) => setStat({ penalties: x })} />
          </div>
          <div className="statrow">
            <span>Bunker</span>
            <div className="seg">
              {[true, false].map((b) => (
                <button key={String(b)} className={myStats.bunker === b ? 'on' : ''} onClick={() => setStat({ bunker: myStats.bunker === b ? undefined : b })}>
                  {b ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>
          {hole === 0 && (
            <div className="statrow">
              <span>My tees</span>
              <select value={meP.tee} onChange={(e) => set(key.player(me), { ...meP, tee: e.target.value })}>
                {round.course.tees.map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <p className="muted small">Course handicap {courseHandicap(round.course, meP)} off {meP.tee}.</p>
        </section>
      )}
      <button className="primary block" disabled={hole === n - 1} onClick={() => setHole(hole + 1)}>
        Next hole ›
      </button>
    </main>
  )
}

function Stepper({ value, par, disabled, onChange }: { value: number | null; par: number; disabled?: boolean; onChange: (v: number | null) => void }) {
  if (disabled)
    return <div className={`stepper ro ${value === 0 ? 'pu' : ''}`}>{value == null ? '–' : value === 0 ? 'P/U' : value}</div>
  return (
    <div className="stepper">
      <button onClick={() => onChange(value == null || value === 0 ? par - 1 : Math.max(1, value - 1))}>−</button>
      <button className={`val ${value === 0 ? 'pu' : ''} ${value != null && value > 0 ? (value < par ? 'under' : value > par ? 'over' : 'par') : ''}`} onClick={() => onChange(value == null ? par : value === 0 ? null : 0)}>
        {value == null ? 'Par?' : value === 0 ? 'P/U' : value}
      </button>
      <button onClick={() => onChange(value == null || value === 0 ? par + 1 : Math.min(15, value + 1))}>+</button>
    </div>
  )
}

function MiniStepper({ value, start, onChange }: { value?: number; start: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="stepper mini">
      <button onClick={() => onChange(value == null ? Math.max(0, start - 1) : value <= 0 ? undefined : value - 1)}>−</button>
      <span className="val">{value ?? '–'}</span>
      <button onClick={() => onChange(value == null ? start : Math.min(9, value + 1))}>+</button>
    </div>
  )
}

function WolfPicker({
  round,
  game,
  hole,
  byId,
  set,
}: {
  round: Round
  game: Round['games'][number]
  hole: number
  byId: (id: string) => Player
  set: (k: string, v: unknown) => Promise<void>
}) {
  const wolf = currentWolf(round, game, hole)
  const choice: WolfChoice | null | undefined = round.wolf[game.id]?.[hole]
  const pick = (partner: string | null) => set(key.wolf(game.id, hole), choice && choice.partner === partner ? null : { partner })
  return (
    <div className="wolf">
      <div>
        🐺 <strong>{byId(wolf).name}</strong> is Wolf
      </div>
      <div className="seg wrap">
        {game.players
          .filter((p) => p !== wolf)
          .map((p) => (
            <button key={p} className={choice?.partner === p ? 'on' : ''} onClick={() => pick(p)}>
              + {byId(p).name}
            </button>
          ))}
        <button className={choice && choice.partner === null ? 'on' : ''} onClick={() => pick(null)}>
          Lone Wolf
        </button>
      </div>
    </div>
  )
}

// ---------------- Leaderboard ----------------
function Board({ round }: { round: Round }) {
  const results = useMemo(() => roundResults(round), [round])
  const n = round.course.holes.length
  return (
    <main className="pad">
      {results.length === 0 && <p className="muted">No games set up for this round.</p>}
      {results.map((res) => (
        <section className="result" key={res.game.id}>
          <h3>{res.title}</h3>
          {res.note && <p className="muted small">{res.note}</p>}
          <table className="standings">
            <tbody>
              {res.standings.map((s, i) => (
                <tr key={s.id}>
                  <td className="pos">{i + 1}</td>
                  <td>
                    {s.label}
                    {s.detail && <div className="muted small">{s.detail}</div>}
                  </td>
                  <td className="val">{s.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <section className="result">
        <h3>Scorecards (gross)</h3>
        <div className="gridwrap">
          <table className="grid">
            <thead>
              <tr>
                <th></th>
                {round.course.holes.map((h) => (
                  <th key={h.n}>{h.n}</th>
                ))}
                <th>Tot</th>
              </tr>
              <tr className="muted">
                <th>Par</th>
                {round.course.holes.map((h) => (
                  <th key={h.n}>{h.par_m}</th>
                ))}
                <th>{round.course.holes.reduce((s, h) => s + h.par_m, 0)}</th>
              </tr>
            </thead>
            <tbody>
              {round.players.map((p) => {
                const sc = round.scores[p.id] ?? []
                return (
                  <tr key={p.id}>
                    <th>{p.name}</th>
                    {Array.from({ length: n }, (_, i) => {
                      const v = sc[i]
                      const par = holePar(round.course.holes[i], p)
                      return (
                        <td key={i} className={v ? (v < par ? 'under' : v > par ? 'over' : '') : ''}>
                          {v == null ? '' : v === 0 ? '–' : v}
                        </td>
                      )
                    })}
                    <td>{sc.reduce<number>((s, v) => s + (v ?? 0), 0) || ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

// ---------------- Settle up ----------------
function money(v: number) {
  const s = Math.abs(v).toFixed(2).replace(/\.00$/, '')
  return `£${s}`
}

function Settle({ round }: { round: Round }) {
  const results = useMemo(() => roundResults(round), [round])
  const totals = moneyTotals(results)
  const payments = settle(totals)
  const name = (id: string) => round.players.find((p) => p.id === id)?.name ?? id
  const anyStake = round.games.some((g) => g.stake > 0)
  const text = payments.map((p) => `${name(p.from)} pays ${name(p.to)} ${money(p.amount)}`).join('\n')

  if (!anyStake) return <main className="pad"><p className="muted">No money games in this round.</p></main>
  return (
    <main className="pad">
      <section className="result">
        <h3>Who pays who</h3>
        {payments.length === 0 && <p className="muted">All square so far.</p>}
        <ul className="payments">
          {payments.map((p, i) => (
            <li key={i}>
              <strong>{name(p.from)}</strong> pays <strong>{name(p.to)}</strong> <span className="amt">{money(p.amount)}</span>
            </li>
          ))}
        </ul>
        {payments.length > 0 && (
          <button className="secondary" onClick={() => (navigator.share ? navigator.share({ text: `${round.name}\n${text}` }).catch(() => {}) : navigator.clipboard.writeText(text))}>
            Share results
          </button>
        )}
        <p className="muted small">Match bets, stroke play and scramble pay out once those games finish. Points games update live.</p>
      </section>
      <section className="result">
        <h3>By game</h3>
        <table className="standings">
          <tbody>
            {results
              .filter((r) => r.game.stake > 0)
              .map((r) => (
                <tr key={r.game.id}>
                  <td>{r.title}</td>
                  <td className="val small">
                    {Object.entries(r.money)
                      .filter(([, v]) => Math.abs(v) > 0.001)
                      .sort((a, b) => b[1] - a[1])
                      .map(([id, v]) => `${name(id)} ${v >= 0 ? '+' : '−'}${money(v)}`)
                      .join(', ') || '–'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
      <section className="result">
        <h3>Net totals</h3>
        <table className="standings">
          <tbody>
            {round.players
              .map((p) => ({ p, v: totals[p.id] ?? 0 }))
              .sort((a, b) => b.v - a.v)
              .map(({ p, v }) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className={`val ${v > 0 ? 'gain' : v < 0 ? 'loss' : ''}`}>
                    {v >= 0 ? '+' : '−'}
                    {money(v)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
