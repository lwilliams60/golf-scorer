import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { sb } from './backend'
import { saveProfile, type Profile } from './profile'

/** Text-message sign-in is switched on once Twilio is set up in Supabase. */
export const phoneSignIn = !!sb && import.meta.env.VITE_PHONE_SIGNIN === '1'

/** Turns a UK mobile typed any common way (07…, 7…, +44 7…, 0044…) into +447…; other countries need a leading +. */
export function toE164(raw: string): string | null {
  let d = raw.replace(/[\s()-]/g, '')
  if (d.startsWith('00')) d = '+' + d.slice(2)
  if (d.startsWith('+')) return /^\+\d{8,15}$/.test(d) ? d : null
  if (d.startsWith('0')) d = d.slice(1)
  return /^7\d{9}$/.test(d) ? '+44' + d : null
}

export async function sendCode(phone: string) {
  const { error } = await sb!.auth.signInWithOtp({ phone })
  if (error) throw error
}

export async function verifyCode(phone: string, token: string) {
  const { data, error } = await sb!.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) throw error
  return data.session
}

export async function signOut() {
  await sb?.auth.signOut()
}

/** Profile details kept on the account, so a new phone picks them up after signing in. */
export function profileFromSession(s: Session): Profile | null {
  const m = s.user.user_metadata as Partial<Profile> & { profileId?: string }
  if (!m?.name || m.handicapIndex == null) return null
  return { id: m.profileId ?? s.user.id, name: m.name, handicapIndex: m.handicapIndex, gender: m.gender ?? 'm' }
}

export async function saveProfileToAccount(p: Profile) {
  saveProfile(p)
  if (!phoneSignIn) return
  await sb!.auth.updateUser({ data: { profileId: p.id, name: p.name, handicapIndex: p.handicapIndex, gender: p.gender } })
}

/** undefined while checking, null when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(phoneSignIn ? undefined : null)
  useEffect(() => {
    if (!phoneSignIn) return
    sb!.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb!.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

