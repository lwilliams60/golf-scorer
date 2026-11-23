import { useState } from 'react'
import { go } from '../nav'
import { backend } from '../store/backend'
import { assemble, key, write, type StoredPlayer } from '../store/round'
import { setMyPlayerIn, type Profile } from '../store/profile'
import type { Round } from '../engine/types'

export function JoinRound({ profile, initialCode }: { profile: Profile; initialCode?: string }) {
  const [code, setCode] = useState((initialCode ?? '').toUpperCase())
  const [round, setRound] = useState<Round | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
            <p className="muted">{round.course.name} · Which player are you?</p>
            <ul className="list">
              {(round.players as StoredPlayer[]).map((p) => (
                <li key={p.id} onClick={() => pick(p)}>
                  <strong>{p.name}</strong>
                  <span className="muted">
                    Handicap {p.handicapIndex} · {p.tee} tees{p.profileId && p.profileId !== profile.id ? ' · already claimed' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  )
}
