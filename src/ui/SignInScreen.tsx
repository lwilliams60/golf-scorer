import { useState } from 'react'
import { sendCode, toE164, verifyCode } from '../store/auth'

export function SignInScreen() {
  const [raw, setRaw] = useState('')
  const [phone, setPhone] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const e164 = toE164(raw)

  async function send() {
    if (!e164) return
    setBusy(true)
    setErr('')
    try {
      await sendCode(e164)
      setPhone(e164)
    } catch {
      setErr("We couldn't send a text to that number. Check it and try again.")
    }
    setBusy(false)
  }

  async function verify(c: string) {
    setBusy(true)
    setErr('')
    try {
      await verifyCode(phone!, c)
    } catch {
      setErr("That code didn't work. Check the text or send a new one.")
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="top" style={{ minHeight: 0 }} />
      <main className="pad" style={{ paddingLeft: 24, paddingRight: 24 }}>
        {!phone ? (
          <>
            <h1 className="bigtitle">Sign in with your mobile</h1>
            <p className="lead">We'll text you a 6-digit code. No password to remember.</p>
            <label className="field">
              Mobile number
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="07xxx xxxxxx"
                style={{ fontSize: 20, height: 56 }}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
            </label>
            <button className="primary block" disabled={!e164 || busy} onClick={send}>
              {busy ? 'Sending…' : 'Text me a code'}
            </button>
            <p className="muted small" style={{ marginTop: 16 }}>
              Your number is only used to sign you in. It's stored securely with your account and never shared with other players.
            </p>
          </>
        ) : (
          <>
            <button className="link muted" onClick={() => (setPhone(null), setCode(''))}>
              ‹ Back
            </button>
            <h1 className="bigtitle">Enter your code</h1>
            <p className="lead">We've texted a 6-digit code to your mobile ending ••{phone.slice(-2)}.</p>
            <input
              className="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={code}
              disabled={busy}
              aria-label="6-digit code"
              style={{ height: 64, fontSize: 30 }}
              onChange={(e) => {
                const c = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(c)
                if (c.length === 6) verify(c)
              }}
            />
            <p className="muted small" style={{ marginTop: 14 }}>
              Didn't arrive?{' '}
              <button className="link" style={{ color: 'var(--accent)' }} disabled={busy} onClick={send}>
                Text me again
              </button>
            </p>
          </>
        )}
        {err && <p className="warn">{err}</p>}
      </main>
    </div>
  )
}
