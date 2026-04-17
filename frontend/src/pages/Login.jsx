// Login screen — one email field, one button, sends a magic link.
// Turnstile widget renders invisibly via the Cloudflare script.
import { useEffect, useRef, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { normalizeEmail, isDisposable, looksLikeEmail } from '../lib/emailCheck'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState({ type: '', msg: '' })
  const [sent, setSent] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState(null)
  const widgetRef = useRef(null)

  // Load Turnstile script once and render the widget
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return // no CAPTCHA configured — that's OK for dev, Supabase will still enforce rate limits
    if (window.turnstile) {
      renderWidget()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = renderWidget
    document.head.appendChild(s)
    function renderWidget() {
      if (!widgetRef.current || widgetRef.current.dataset.rendered) return
      widgetRef.current.dataset.rendered = '1'
      window.turnstile.render(widgetRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => setTurnstileToken(null),
      })
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!supabaseConfigured) {
      setStatus({ type: 'error', msg: 'Sign-in is not configured yet. Check back soon.' })
      return
    }
    const raw = email.trim()
    if (!looksLikeEmail(raw)) {
      setStatus({ type: 'error', msg: 'That doesn\u2019t look like a valid email.' }); return
    }
    const normalized = normalizeEmail(raw)
    if (isDisposable(normalized)) {
      setStatus({ type: 'error', msg: 'Please use a real email address so you can find your data again later.' })
      return
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setStatus({ type: 'error', msg: 'Please complete the CAPTCHA.' })
      return
    }

    setStatus({ type: 'loading', msg: 'Sending your magic link...' })
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        emailRedirectTo: window.location.origin,
        captchaToken: turnstileToken || undefined,
      },
    })
    if (error) {
      setStatus({ type: 'error', msg: error.message })
      return
    }
    setSent(true)
    setStatus({ type: 'success', msg: `We sent a sign-in link to ${normalized}. Check your inbox!` })
  }

  return (
    <div className="login-page">
      <header className="app-header" style={{ cursor: 'default' }}>
        <img src="/penny.png" alt="Penny" className="header-penny" />
        <h1>A Penny <span>For Cancer</span></h1>
      </header>

      <main className="login-main">
        <div className="login-card">
          <img src="/penny.png" alt="Penny" className="hero-penny" style={{ width: 96, height: 96 }} />
          <h2>Sign in to your mole tracker</h2>
          <p className="login-sub">We'll email you a one-click sign-in link. No password needed.</p>

          {!sent ? (
            <form onSubmit={handleSubmit} className="login-form">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <div ref={widgetRef} className="turnstile-widget" />
              <button type="submit" className="btn btn-primary" disabled={status.type === 'loading'}>
                {status.type === 'loading' ? <><span className="spinner" />Sending...</> : '\u2709 Send me a magic link'}
              </button>
              {status.msg && status.type !== 'success' && (
                <div className={`status-bar ${status.type}`}>{status.msg}</div>
              )}
            </form>
          ) : (
            <div className="login-sent">
              <div className="login-sent-icon">\uD83D\uDCEC</div>
              <p>{status.msg}</p>
              <button className="btn btn-outline" onClick={() => { setSent(false); setStatus({ type: '', msg: '' }) }}>Use a different email</button>
            </div>
          )}

          <p className="login-footnote">
            By signing in you agree that this is a fun project, not a medical device.
            Your measurements are saved to your email &mdash; sign in again to pick up where you left off.
          </p>
        </div>

        <footer className="powered-by">
          Powered by <a href="https://roboflow.com" target="_blank" rel="noopener noreferrer">Roboflow</a>
        </footer>
      </main>
    </div>
  )
}
