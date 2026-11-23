import { useEffect, useState } from 'react'
import { go } from './nav'
import { loadProfile, type Profile } from './store/profile'
import { ProfileScreen } from './ui/ProfileScreen'
import { HomeScreen } from './ui/HomeScreen'
import { CreateRound } from './ui/CreateRound'
import { JoinRound } from './ui/JoinRound'
import { RoundScreen } from './ui/RoundScreen'
import { StatsScreen } from './ui/StatsScreen'
import { CoachScreen } from './ui/CoachShare'
import { SignInScreen } from './ui/SignInScreen'
import { phoneSignIn, profileFromSession, saveProfileToAccount, useSession } from './store/auth'
import { saveProfile } from './store/profile'

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1))
  useEffect(() => {
    const h = () => {
      setHash(window.location.hash.slice(1))
      // A new screen always opens at the top.
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return hash
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile)
  const hash = useHash()
  const [route, arg] = hash.split('/')
  const session = useSession()

  // Signed in on a new phone: pick up name and handicap from the account.
  useEffect(() => {
    if (!session) return
    const p = profileFromSession(session)
    // First sign-in on a phone that already has a profile: keep its id so earlier rounds stay linked.
    if (!p && profile) saveProfileToAccount(profile).catch(() => {})
    if (p && (!profile || profile.id !== p.id || profile.name !== p.name || profile.handicapIndex !== p.handicapIndex)) {
      saveProfile(p)
      setProfile(p)
    }
  }, [session, profile])

  if (route === 'coach' && arg) return <CoachScreen token={arg} />
  if (phoneSignIn) {
    if (session === undefined) return <div className="screen" />
    if (session === null) return <SignInScreen />
  }
  if (!profile || route === 'profile')
    return (
      <ProfileScreen
        profile={profile}
        onSave={(p) => {
          setProfile(p)
          go('')
        }}
      />
    )
  if (route === 'create') return <CreateRound profile={profile} />
  if (route === 'join') return <JoinRound profile={profile} initialCode={arg} />
  if (route === 'round' && arg) return <RoundScreen code={arg} profile={profile} />
  if (route === 'stats') return <StatsScreen profile={profile} />
  return <HomeScreen profile={profile} />
}
