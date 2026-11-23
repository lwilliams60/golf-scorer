import { Fragment, useMemo, useState } from 'react'
import { go } from '../nav'
import { courseHandicap, holePar, holeSI, playingHandicap, strokesOnHole, teeFor } from '../engine/handicap'
import { TeeSelect } from './TeeSelect'
import { currentWolf } from '../engine/games'
import { moneyTotals, roundResults, settle } from '../engine/settle'
import type { ApproachBand, ApproachResult, HoleStats, Player, PuttBand, Round, TeeResult, WolfChoice } from '../engine/types'
import { APPROACH_BANDS, approachBandLabel, holeFacts, PUTT_BANDS } from '../engine/stats'
import { backend } from '../store/backend'
import { key, useRound } from '../store/round'
import { myPlayerIn, type Profile } from '../store/profile'

type Tab = 'card' | 'board' | 'settle' | 'summary'

export function RoundScreen({ code, profile }: { code: string; profile: Profile }) {
  const { round, status, set, pending } = useRound(code)
  const [tab, setTab] = useState<Tab>('card')
  const [copied, setCopied] = useState(false)
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

  function openTab(t: Tab) {
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  async function share() {
    const url = `${location.origin}${location.pathname}#join/${code}`
    const text = `Join our round "${round!.name}" with code ${code}: ${url}`
    try {
      if (navigator.share) await navigator.share({ title: 'Golf round', text, url })
      else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="screen">
      <div className="sticky">
      <header className="top">
        <button className="link" onClick={() => go('')}>
          ‹ Home
        </button>
        <div className="title">
          <h1>{round.name}</h1>
          <span className="muted small">{round.course.name}</span>
          <button className="invite-btn" onClick={share} aria-label={`Invite players to join with code ${code}`}>
            {copied ? 'Invite link copied' : <>+ Invite players · <span className="invite-code">{code}</span></>}
          </button>
        </div>
        <span className={`sync ${pending ? 'waiting' : ''}`} title={backend.kind === 'local' ? 'Test mode' : pending ? 'Waiting for signal' : 'Synced'}>
          {backend.kind === 'local' ? 'Test' : pending ? `${pending}↑` : '●'}
        </span>
      </header>
      <nav className="tabs">
        {(['card', 'board', 'settle'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => openTab(t)}>
            {t === 'card' ? 'Scorecard' : t === 'board' ? 'Leaderboard' : 'Settle up'}
          </button>
        ))}
      </nav>
      </div>
      {tab === 'card' && <Scorecard round={round} me={me} set={set} profile={profile} onFinish={() => openTab('summary')} />}
      {tab === 'board' && <Board round={round} onSummary={() => openTab('summary')} />}
      {tab === 'summary' && <Summary round={round} onBack={() => openTab('card')} />}
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

function Scorecard({
  round,
  me,
  set,
  onFinish,
}: {
  round: Round
  me: string
  set: (k: string, v: unknown) => Promise<void>
  profile: Profile
  onFinish: () => void
}) {
  const myGroup = round.groups.find((g) => g.players.includes(me)) ?? round.groups[0]
  const [groupId, setGroupId] = useState(myGroup.id)
  const group = round.groups.find((g) => g.id === groupId) ?? myGroup
  const [hole, setHoleState] = useState(() => firstOpenHole(round, group.players))
  // Every hole change starts the next hole from the top of the page.
  const setHole = (i: number) => {
    setHoleState(i)
    window.scrollTo({ top: 0 })
  }
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
    <main className="pad">
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
      {scorer && scorer !== me && <p className="muted small">{byId(scorer).name} is scoring for this group. You can still log your own shots below.</p>}

      {group.players.includes(me) && <QuickStats par={holePar(h, meP)} gross={round.scores[me]?.[hole]} stats={myStats} onChange={setStat} />}
      {group.players.includes(me) && hole === 0 && (
        <div className="statrow" style={{ marginTop: 14 }}>
          <span>My tees</span>
          <TeeSelect course={round.course} tee={meP.tee} gender={meP.gender} onChange={(tee, gender) => set(key.player(me), { ...meP, tee, gender })} />
        </div>
      )}
      {hole === 0 && <p className="muted small">Course handicap {courseHandicap(round.course, meP)} off {meP.tee}.</p>}
      {hole < n - 1 ? (
        <button className="primary block" onClick={() => setHole(hole + 1)}>
          Next hole ›
        </button>
      ) : (
        <FinishButton round={round} players={group.players} onFinish={onFinish} onGoTo={setHole} />
      )}
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

const TEE_CHIPS: [TeeResult, string][] = [
  ['left', '← Left'],
  ['fairway', 'Fairway'],
  ['right', 'Right →'],
  ['bunker', 'Bunker'],
  ['penalty', 'Penalty'],
]
const APPROACH_CHIPS: [ApproachResult, string][] = [
  ['green', 'Green'],
  ['short', 'Short'],
  ['long', 'Long'],
  ['left', 'Left'],
  ['right', 'Right'],
  ['bunker', 'Bunker'],
]

function Chips<T extends string | number>({ items, value, onPick }: { items: [T, string][]; value: T | undefined; onPick: (v: T | undefined) => void }) {
  return (
    <div className="chips">
      {items.map(([v, label]) => (
        <button key={String(v)} className={`chip ${value === v ? 'on' : ''}`} aria-pressed={value === v} onClick={() => onPick(value === v ? undefined : v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** A few taps per hole. Everything else (GIR, up and downs, sand saves, strokes gained) is worked out. */
function QuickStats({ par, gross, stats, onChange }: { par: number; gross: number | null | undefined; stats: HoleStats; onChange: (p: Partial<HoleStats>) => void }) {
  const tee = stats.tee ?? (stats.fairway === 'hit' ? 'fairway' : stats.fairway === 'left' || stats.fairway === 'right' ? stats.fairway : undefined)
  const f = holeFacts(par, gross, stats)
  const notes: string[] = []
  const from = f.approachDist ? ` from ${approachBandLabel(f.approachDist)}` : ''
  if (f.gir === true) notes.push(`Green in regulation${from}`)
  if (f.gir === false) notes.push(`Missed green${from}`)
  if (f.sandChance && f.score != null) notes.push(f.sandSaved ? 'sand save' : 'bunker save missed')
  else if (f.scrambleChance) notes.push(f.scrambled ? 'up and down' : 'up and down missed')
  if (f.putts != null) notes.push(`${f.putts} putt${f.putts === 1 ? '' : 's'}${f.firstPutt ? ` from ${PUTT_BANDS.find((b) => b.id === f.firstPutt)!.label}` : ''}`)
  const sg = (
    [
      ['tee', f.sg.tee],
      ['approach', f.sg.approach],
      ['around green', f.sg.around],
      ['putting', f.sg.putting],
    ] as [string, number | null][]
  )
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k} ${v! > 0 ? '+' : v! < 0 ? '−' : ''}${Math.abs(v!).toFixed(1)}`)
  return (
    <section>
      {par >= 4 && (
        <div className="chipgroup">
          <div className="sechead">
            <strong>Tee shot</strong>
            <span>par 4s and 5s</span>
          </div>
          <Chips items={TEE_CHIPS} value={tee} onPick={(v) => onChange({ tee: v, fairway: undefined })} />
        </div>
      )}
      <div className="chipgroup">
        <div className="sechead">
          <strong>Approach distance</strong>
          <span>yards to the pin</span>
        </div>
        <Chips items={APPROACH_BANDS.map((b) => [b.id, b.label] as [ApproachBand, string])} value={stats.approachDist} onPick={(v) => onChange({ approachDist: v })} />
      </div>
      <div className="chipgroup">
        <div className="sechead">
          <strong>Approach</strong>
          <span>green or where it missed</span>
        </div>
        <Chips items={APPROACH_CHIPS} value={stats.approach} onPick={(v) => onChange({ approach: v, gir: undefined })} />
      </div>
      <div className="chipgroup">
        <div className="sechead">
          <strong>First putt</strong>
          <span>roughly how far</span>
        </div>
        <Chips items={PUTT_BANDS.map((b) => [b.id, b.label] as [PuttBand, string])} value={stats.firstPutt} onPick={(v) => onChange({ firstPutt: v })} />
      </div>
      <div className="puttrow">
        <strong>Putts</strong>
        <Chips
          items={[
            [0, '0'],
            [1, '1'],
            [2, '2'],
            [3, '3'],
            [4, '4+'],
          ]}
          value={stats.putts}
          onPick={(v) => onChange({ putts: v })}
        />
      </div>
      {notes.length > 0 && (
        <div className="worked">
          <span className="eyebrow">Worked out for you</span>
          <span>
            {notes.join(' · ')}
            {sg.length > 0 && ` · strokes gained: ${sg.join(', ')}`}
          </span>
        </div>
      )}
    </section>
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
function Board({ round, onSummary }: { round: Round; onSummary: () => void }) {
  const results = useMemo(() => roundResults(round), [round])
  return (
    <main className="pad">
      {missingScores(round, round.players.map((p) => p.id)).length === 0 && (
        <button className="secondary block" onClick={onSummary}>
          Round summary
        </button>
      )}
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
        <ScoreGrid round={round} />
      </section>
    </main>
  )
}

// ---------------- Settle up ----------------
function money(v: number) {
  const s = Math.abs(v).toFixed(2).replace(/\.00$/, '')
  return `£${s}`
}

function Payments({ round, totals, final }: { round: Round; totals: Record<string, number>; final?: boolean }) {
  const payments = settle(totals)
  const name = (id: string) => round.players.find((p) => p.id === id)?.name ?? id
  const text = payments.map((p) => `${name(p.from)} pays ${name(p.to)} ${money(p.amount)}`).join('\n')
  return (
    <section className="result">
      <h3>Who pays who</h3>
      {payments.length === 0 && <p className="muted">{final ? 'All square, nobody owes anything.' : 'All square so far.'}</p>}
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
      {!final && <p className="muted small">Match bets, stroke play and scramble pay out once those games finish. Points games update live.</p>}
    </section>
  )
}

function Settle({ round }: { round: Round }) {
  const results = useMemo(() => roundResults(round), [round])
  const totals = moneyTotals(results)
  const name = (id: string) => round.players.find((p) => p.id === id)?.name ?? id
  const anyStake = round.games.some((g) => g.stake > 0)

  if (!anyStake) return <main className="pad"><p className="muted">No money games in this round.</p></main>
  return (
    <main className="pad">
      <Payments round={round} totals={totals} />
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

// ---------------- Finishing ----------------
/** Holes each player is still missing a score on (1-based), only for players with gaps. */
function missingScores(round: Round, players: string[]) {
  const n = round.course.holes.length
  return players
    .map((id) => ({ id, holes: Array.from({ length: n }, (_, i) => i).filter((i) => round.scores[id]?.[i] == null) }))
    .filter((m) => m.holes.length > 0)
}

function FinishButton({ round, players, onFinish, onGoTo }: { round: Round; players: string[]; onFinish: () => void; onGoTo: (hole: number) => void }) {
  const missing = missingScores(round, players)
  const name = (id: string) => round.players.find((p) => p.id === id)?.name ?? id
  if (missing.length === 0)
    return (
      <button className="primary block" onClick={onFinish}>
        Finish round ✓
      </button>
    )
  const first = Math.min(...missing.map((m) => m.holes[0]))
  return (
    <div className="finish-wait">
      <p className="small">
        <strong>Scores still needed to finish:</strong>
        <br />
        {missing.map((m) => `${name(m.id)}: ${m.holes.map((i) => round.course.holes[i].n).join(', ')}`).join(' · ')}
      </p>
      <button className="secondary block" onClick={() => onGoTo(first)}>
        Go to hole {round.course.holes[first].n}
      </button>
    </div>
  )
}

/** Full scorecard with out, in and total, coloured against each player's par. */
function ScoreGrid({ round }: { round: Round }) {
  const holes = round.course.holes
  const n = holes.length
  const split = n === 18 ? 9 : n
  const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0)
  const parRow = holes.map((h) => h.par_m)
  const cells = (vals: (number | null | undefined)[], pars: number[]) => {
    const out: React.ReactNode[] = []
    vals.forEach((v, i) => {
      out.push(
        <td key={i} className={v ? (v < pars[i] ? 'under' : v > pars[i] ? 'over' : '') : ''}>
          {v == null ? '' : v === 0 ? '–' : v}
        </td>,
      )
      if (split < n && i === split - 1) out.push(<td key="out" className="sub">{sum(vals.slice(0, split)) || ''}</td>)
    })
    if (split < n) out.push(<td key="in" className="sub">{sum(vals.slice(split)) || ''}</td>)
    out.push(<td key="tot" className="sub">{sum(vals) || ''}</td>)
    return out
  }
  return (
    <div className="gridwrap">
      <table className="grid">
        <thead>
          <tr>
            <th></th>
            {holes.map((h, i) => (
              <Fragment key={h.n}>
                <th>{h.n}</th>
                {split < n && i === split - 1 && <th className="sub">Out</th>}
              </Fragment>
            ))}
            {split < n && <th className="sub">In</th>}
            <th className="sub">Tot</th>
          </tr>
          <tr className="muted">
            <th>Par</th>
            {cells(parRow, parRow).map((c, i) => (
              <Fragment key={i}>{c}</Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {round.players.map((p) => {
            const sc = Array.from({ length: n }, (_, i) => round.scores[p.id]?.[i])
            return (
              <tr key={p.id}>
                <th>{p.name}</th>
                {cells(
                  sc,
                  holes.map((h) => holePar(h, p)),
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Summary({ round, onBack }: { round: Round; onBack: () => void }) {
  const results = useMemo(() => roundResults(round), [round])
  const totals = moneyTotals(results)
  const anyStake = round.games.some((g) => g.stake > 0)
  const missing = missingScores(round, round.players.map((p) => p.id))
  const name = (id: string) => round.players.find((p) => p.id === id)?.name ?? id
  return (
    <main className="pad">
      <h2 style={{ marginTop: 4 }}>Round summary</h2>
      <p className="muted small">
        {round.course.name} · {new Date(round.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      {missing.length > 0 && (
        <p className="small warn">Not everyone has finished yet, so these results may change. Still to come: {missing.map((m) => name(m.id)).join(', ')}.</p>
      )}
      {results.map((res) => (
        <section className="result" key={res.game.id}>
          <h3>{res.title}</h3>
          {res.standings[0] && (
            <p className="winner">
              🏆 {res.standings[0].label} <span className="muted">{res.standings[0].display}</span>
            </p>
          )}
          <table className="standings">
            <tbody>
              {res.standings.map((s, i) => (
                <tr key={s.id}>
                  <td className="pos">{i + 1}</td>
                  <td>{s.label}</td>
                  <td className="val">{s.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {anyStake && (
        <>
          <Payments round={round} totals={totals} final={missing.length === 0} />
          <section className="result">
            <h3>Money won and lost</h3>
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
        </>
      )}
      <section className="result">
        <h3>Full scorecard</h3>
        <ScoreGrid round={round} />
      </section>
      <button className="secondary block" onClick={onBack}>
        ‹ Back to scorecard
      </button>
      <button className="primary block" style={{ marginTop: 10 }} onClick={() => go('')}>
        Done
      </button>
    </main>
  )
}
