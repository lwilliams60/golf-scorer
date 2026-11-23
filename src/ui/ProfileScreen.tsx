import { useState } from 'react'
import { saveProfile, type Profile } from '../store/profile'
import type { Gender } from '../engine/types'
import { newId } from '../store/round'

export function ProfileScreen({ profile, onSave }: { profile: Profile | null; onSave: (p: Profile) => void }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [index, setIndex] = useState(profile ? String(profile.handicapIndex) : '')
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'm')
  const idx = Number(index)
  const valid = name.trim() && index.trim() !== '' && !Number.isNaN(idx) && idx >= -10 && idx <= 54

  return (
    <div className="screen">
      <header className="top">
        <h1>{profile ? 'Your details' : 'Welcome'}</h1>
      </header>
      <main className="pad">
        {!profile && <p className="muted">Set up your player profile. Your handicap is used to work out your strokes on each hole.</p>}
        <label className="field">
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Luke" autoFocus />
        </label>
        <label className="field">
          Handicap Index
          <input inputMode="decimal" value={index} onChange={(e) => setIndex(e.target.value)} placeholder="e.g. 14.2" />
        </label>
        <div className="field">
          Card
          <div className="seg">
            <button className={gender === 'm' ? 'on' : ''} onClick={() => setGender('m')}>
              Men's
            </button>
            <button className={gender === 'w' ? 'on' : ''} onClick={() => setGender('w')}>
              Women's
            </button>
          </div>
        </div>
        <button
          className="primary block"
          disabled={!valid}
          onClick={() => {
            const p: Profile = { id: profile?.id ?? newId(), name: name.trim(), handicapIndex: idx, gender }
            saveProfile(p)
            onSave(p)
          }}
        >
          Save
        </button>
      </main>
    </div>
  )
}
