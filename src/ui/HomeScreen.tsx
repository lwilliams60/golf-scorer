import { useEffect, useMemo, useState } from 'react'
import { go } from '../nav'
import { type Profile } from '../store/profile'
import { backend } from '../store/backend'
import { loadMyRounds, type MyRound } from '../store/history'
import { focusAreas, summarise } from '../engine/stats'
import { mantraFor } from '../data/mantras'
import { FocusList, SgBars, Tiles, money, shortDate } from './Insights'
import { ShareWithCoach } from './CoachShare'

const SNAPSHOT = 6

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
}

export function HomeScreen({ profile }: { profile: Profile }) {
  const [mine, setMine] = useState<MyRound[] | null>(null)
  useEffect(() => {
    loadMyRounds(profile).then(setMine)
  }, [profile])

  const last = useMemo(() => (mine ?? []).slice(0, SNAPSHOT), [mine])
  const summary = useMemo(() => summarise(last.map((m) => m.facts)), [last])
  const focus = useMemo(() => focusAreas(summary), [summary])
  const full = last.filter((m) => m.facts.holesPlayed === 18)
  const stableford = full.length ? full.reduce((s, m) => s + m.points, 0) / full.length : null
  const initials = profile.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="screen">
      <header className="top">
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <div className="hello">
          <strong>
            {greeting()}, {profile.name.split(' ')[0]}
          </strong>
          <span>Handicap Index {profile.handicapIndex}</span>
        </div>
        <button className="iconbtn" aria-label="Your details" onClick={() => go('profile')}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
        </button>
      </header>
      <main className="pad stack withdock">
        <section className="card mantra">
          <span className="eyebrow">Today's mantra</span>
          <p>{mantraFor()}</p>
        </section>

        {mine && mine.length === 0 && (
          <section className="card">
            <strong>Your stats start here</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              Play a round and log a few taps per hole: tee shot, approach, first putt and putts. Your snapshot, strokes gained and what to work on will
              appear here.
            </p>
          </section>
        )}

        {last.length > 0 && (
          <>
            <section className="stack" style={{ gap: 10 }}>
              <div className="sechead">
                <h2>Your snapshot</h2>
                <span className="muted small">
                  Last {last.length} round{last.length > 1 ? 's' : ''}
                </span>
              </div>
              <Tiles s={summary} stableford={stableford} />
            </section>
            <SgBars s={summary} />
            <FocusList focus={focus} />
            <ShareWithCoach profile={profile} mine={mine!} />
            <section className="stack" style={{ gap: 10 }}>
              <div className="sechead">
                <h2>Recent rounds</h2>
                <button className="link small" style={{ color: 'var(--accent)' }} onClick={() => go('stats')}>
                  All stats ›
                </button>
              </div>
              {mine!.slice(0, 5).map((m) => (
                <button className="rrow" key={m.round.code} onClick={() => go(`round/${m.round.code}`)}>
                  <span>
                    <strong>{m.round.course.name}</strong>
                    <span className="muted small">
                      {shortDate(m.round.date)}
                      {m.games ? ` · ${m.games}` : ''}
                    </span>
                  </span>
                  <span>
                    <strong style={{ fontSize: 17 }}>
                      {m.facts.gross}
                      {m.facts.holesPlayed < 18 ? ` (${m.facts.holesPlayed})` : ''}
                    </strong>
                    <span className={`small ${m.money > 0.001 ? 'good' : m.money < -0.001 ? 'bad' : 'muted'}`}>
                      {m.points} pts
                      {Math.abs(m.money) > 0.001 ? ` · ${m.money > 0 ? 'won' : 'lost'} ${money(m.money)}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          </>
        )}
        {mine === null && <p className="muted">Loading your rounds…</p>}
        {backend.kind === 'local' && <p className="muted small">Test mode: rounds are saved on this phone only until live sync is switched on.</p>}
      </main>
      <div className="dock">
        <div>
          <button className="primary" onClick={() => go('create')}>
            Start a round
          </button>
          <button className="secondary" onClick={() => go('join')}>
            Join with code
          </button>
        </div>
      </div>
    </div>
  )
}
