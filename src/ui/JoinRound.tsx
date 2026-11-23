import { useEffect, useState } from 'react'
import { go } from '../nav'
import { backend } from '../store/backend'
import { assemble, key, newId, write, type StoredPlayer } from '../store/round'
import { setMyPlayerIn, type Profile } from '../store/profile'
import type { Round } from '../engine/types'

export function JoinRound({ profile, initialCode }: { profile: Profile; initialCode?: string }) {
  const [code, setCode] = useState((initialCode ?? '').toUpperCase())
  const [round, setRound] = useState<Round | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Opened from an invite link: look the round up straight away.
  useEffect(() => {
    if ((initialCode ?? '').trim().length === 6) find()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function find() {
    setBusy(true)
    setError('')
    try {
      const e = await backend.load(code.trim().toUpperCase())
      const r = e ? assemble(code.trim().toUpperCase(), e) : null
      if (!r) setError('No round found with that code.')
      setRound(r)
    } catch {
      setError("Couldn't reach the server. Check your signal and try again.")
    }
    setBusy(false)
  }

  const mine = round?.players.find((p) => (p as StoredPlayer).profileId === profile.id)
  // Names the organiser typed in that nobody has claimed yet.
  const open = (round?.players ?? []).filter((p) => !(p as StoredPlayer).profileId) as StoredPlayer[]
  const likely = open.find((p) => p.name.trim().toLowerCase() === profile.name.trim().toLowerCase())

  async function joinAsMe() {
    if (mine) {
      setMyPlayerIn(round!.code, mine.id)
      go(`round/${round!.code}`)
      return
    }
    setBusy(true)
    const p: StoredPlayer = {
      id: newId(),
      name: profile.name,
      handicapIndex: profile.handicapIndex,
      gender: profile.gender,
      tee: round!.course.tees[0]?.name ?? '',
      profileId: profile.id,
      joined: Date.now(),
    }
    await write(round!.code, key.player(p.id), p)
    setMyPlayerIn(round!.code, p.id)
    go(`round/${round!.code}`)
  }

  async function pick(p: StoredPlayer) {
    const updated: StoredPlayer = { ...p, profileId: profile.id, handicapIndex: p.handicapIndex ?? profile.handicapIndex }
    await write(round!.code, key.player(p.id), updated)
    setMyPlayerIn(round!.code, p.id)
    go(`round/${round!.code}`)
  }

  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={() => go('')}>
          ‹ Back
        </button>
        <h1>Join a round</h1>
      </header>
      <main className="pad">
        {!round && (
          <>
            <label className="field">
              Round code
              <input
                className="code"
                value={code}
                maxLength={6}
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
              />
            </label>
            <button className="primary block" disabled={code.trim().length !== 6 || busy} onClick={find}>
              {busy ? 'Looking…' : 'Find round'}
            </button>
            {error && <p className="warn">{error}</p>}
          </>
        )}
        {round && (
          <>
            <h2>{round.name}</h2>
            <p className="muted">
              {round.course.name} · {round.players.length} {round.players.length === 1 ? 'player' : 'players'} in {round.groups.length}{' '}
              {round.groups.length === 1 ? 'group' : 'groups'}
            </p>
            {mine ? (
              <button className="primary block" onClick={joinAsMe}>
                You're in as {mine.name}. Open round ›
              </button>
            ) : likely ? (
              <button className="primary block" onClick={() => pick(likely)}>
                I'm {likely.name}. Join ›
              </button>
            ) : (
              <>
                <button className="primary block" disabled={busy} onClick={joinAsMe}>
                  {busy ? 'Joining…' : `Join as ${profile.name} · hcp ${profile.handicapIndex}`}
                </button>
                <p className="muted small">You'll be put in the next group with a space. The organiser can move you.</p>
              </>
            )}
            {!mine && open.filter((p) => p !== likely).length > 0 && (
              <>
                <h3 className="join-sub">Or, if the organiser already added you, tap your name</h3>
                <ul className="list">
                  {open
                    .filter((p) => p !== likely)
                    .map((p) => (
                      <li key={p.id} onClick={() => pick(p)}>
                        <strong>{p.name}</strong>
                        <span className="muted">
                          Handicap {p.handicapIndex} · {p.tee} tees
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
