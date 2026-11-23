import { useEffect, useState } from 'react'
import { go } from './nav'
import { loadProfile, type Profile } from './store/profile'
import { ProfileScreen } from './ui/ProfileScreen'
import { HomeScreen } from './ui/HomeScreen'
import { CreateRound } from './ui/CreateRound'
import { JoinRound } from './ui/JoinRound'
import { RoundScreen } from './ui/RoundScreen'
import { StatsScreen } from './ui/StatsScreen'

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1))
  useEffect(() => {
    const h = () => setHash(window.location.hash.slice(1))
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return hash
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile)
  const hash = useHash()
  const [route, arg] = hash.split('/')

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
