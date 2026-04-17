import { useState, useRef, useEffect, createContext, useContext, useMemo } from 'react'
import './App.css'

const API = ''
const PaintContext = createContext()

// Roboflow config — calls go through /api/rf Edge function proxy
// (serverless.roboflow.com has no CORS headers; Python serverless hit Cloudflare 1010 block)
const RF_PENNY_WORKFLOW = 'penny-area-measurement-pipeline-1776292482637'
const RF_CLASSIFY_WORKFLOW = 'custom-workflow-11'

async function callRoboflowWorkflow(workflowId, imageBase64) {
  const resp = await fetch('/api/rf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowId, imageBase64 }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Roboflow proxy error ${resp.status}: ${text}`)
  }
  const data = await resp.json()
  return data.outputs || data
}

// ═════════════════════════════════════════════════════════════
// AVATAR BUILDER CONFIG — Cartoon mole animals (not people!)
// ═════════════════════════════════════════════════════════════
// 10 base "poses" — each gives the mole a different face/expression
const MOLE_POSES = [
  { id: 'sleepy',    label: 'Sleepy' },
  { id: 'happy',     label: 'Happy' },
  { id: 'shy',       label: 'Shy' },
  { id: 'wink',      label: 'Wink' },
  { id: 'excited',   label: 'Excited' },
  { id: 'curious',   label: 'Curious' },
  { id: 'derpy',     label: 'Derpy' },
  { id: 'zen',       label: 'Zen' },
  { id: 'sparkle',   label: 'Sparkle' },
  { id: 'brave',     label: 'Brave' },
]
const FUR_COLORS = [
  { id: '6a4e35', label: 'Brown' },   { id: '3b2817', label: 'Dark' },
  { id: '8d5524', label: 'Tan' },     { id: '5a5a5a', label: 'Gray' },
  { id: '1a1a1a', label: 'Black' },   { id: 'c9a27b', label: 'Cream' },
  { id: 'd78cc4', label: 'Pink' },    { id: '8ecae6', label: 'Blue' },
]
const NOSE_COLORS = [
  { id: 'ff8fae', label: 'Pink' }, { id: 'ff5c7c', label: 'Rosy' },
  { id: 'a0522d', label: 'Brown' }, { id: '2a2a2a', label: 'Black' },
]
const MOLE_HATS = [
  { id: 'none',    label: 'None' },
  { id: 'beanie',  label: 'Beanie' },
  { id: 'party',   label: 'Party' },
  { id: 'tophat',  label: 'Top Hat' },
  { id: 'flower',  label: 'Flower' },
  { id: 'leaf',    label: 'Leaf' },
]
const MOLE_GLASSES = [
  { id: 'none',    label: 'None' },
  { id: 'round',   label: 'Round' },
  { id: 'square',  label: 'Square' },
  { id: 'stars',   label: 'Stars' },
  { id: 'sun',     label: 'Sunnies' },
  { id: 'monocle', label: 'Monocle' },
]
const MOLE_EXTRAS = [
  { id: 'blush',    label: '😊 Blush' },
  { id: 'freckles', label: '✨ Freckles' },
  { id: 'bandaid',  label: '🩹 Bandaid' },
]

function defaultAvatarConfig(nameOrSeed) {
  const seed = (nameOrSeed || 'mole').toString()
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return {
    pose: MOLE_POSES[h % MOLE_POSES.length].id,
    furColor: FUR_COLORS[(h >> 3) % FUR_COLORS.length].id,
    noseColor: NOSE_COLORS[(h >> 5) % NOSE_COLORS.length].id,
    hat: 'none',
    glasses: 'none',
    extras: [],
  }
}

// ═════════════════════════════════════════════════════════════
// MOLE CHARACTER — SVG cartoon mole animal rendered from config
// Body, paws, snout, whiskers; expression/hat/glasses overlays parameterized.
// ═════════════════════════════════════════════════════════════
function MoleCharacter({ config, size = 64 }) {
  const c = config || defaultAvatarConfig('mole')
  const fur = `#${c.furColor}`
  const furDark = shadeHex(c.furColor, -0.25)
  const nose = `#${c.noseColor}`
  const pose = c.pose || 'happy'

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* White background circle */}
      <circle cx="50" cy="50" r="50" fill="#ffffff" />

      {/* Body (pear-shape) */}
      <ellipse cx="50" cy="68" rx="32" ry="24" fill={fur} />
      {/* Belly accent */}
      <ellipse cx="50" cy="74" rx="18" ry="11" fill={furDark} opacity="0.4" />

      {/* Paws */}
      <ellipse cx="28" cy="82" rx="8" ry="6" fill={fur} />
      <ellipse cx="72" cy="82" rx="8" ry="6" fill={fur} />
      {/* Paw claws */}
      <path d="M 24 84 L 22 87 M 28 85 L 28 89 M 32 84 L 34 87" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M 68 84 L 66 87 M 72 85 L 72 89 M 76 84 L 78 87" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />

      {/* Head (round on top of body) */}
      <circle cx="50" cy="45" r="26" fill={fur} />
      {/* Little tufts on top of head */}
      <path d="M 35 22 Q 38 18 42 22" fill={fur} stroke="none" />
      <path d="M 58 22 Q 62 18 65 22" fill={fur} stroke="none" />

      {/* Snout */}
      <ellipse cx="50" cy="54" rx="11" ry="8" fill={shadeHex(c.furColor, 0.15)} />
      {/* Nose */}
      <ellipse cx="50" cy="50" rx="5" ry="4" fill={nose} />
      <ellipse cx="48" cy="48.5" rx="1.2" ry="1" fill="#fff" opacity="0.8" />

      {/* Whiskers */}
      <g stroke="#2a2a2a" strokeWidth="0.8" strokeLinecap="round" opacity="0.7">
        <line x1="42" y1="54" x2="32" y2="52" />
        <line x1="42" y1="56" x2="32" y2="57" />
        <line x1="58" y1="54" x2="68" y2="52" />
        <line x1="58" y1="56" x2="68" y2="57" />
      </g>

      {/* Eyes — depend on pose */}
      <MoleEyes pose={pose} />

      {/* Mouth / cheeks — depend on pose */}
      <MoleMouth pose={pose} />

      {/* Extras */}
      {c.extras?.includes('blush') && (
        <>
          <ellipse cx="32" cy="48" rx="4" ry="2" fill="#ff9ab1" opacity="0.7" />
          <ellipse cx="68" cy="48" rx="4" ry="2" fill="#ff9ab1" opacity="0.7" />
        </>
      )}
      {c.extras?.includes('freckles') && (
        <g fill="#3a2210" opacity="0.5">
          <circle cx="38" cy="52" r="0.8" /><circle cx="41" cy="55" r="0.7" />
          <circle cx="59" cy="55" r="0.7" /><circle cx="62" cy="52" r="0.8" />
        </g>
      )}
      {c.extras?.includes('bandaid') && (
        <g transform="translate(70 35) rotate(30)">
          <rect x="-7" y="-2.5" width="14" height="5" rx="2" fill="#ffd7a8" stroke="#e09f5c" strokeWidth="0.5" />
          <circle cx="-4" cy="0" r="0.5" fill="#e09f5c" /><circle cx="0" cy="0" r="0.5" fill="#e09f5c" /><circle cx="4" cy="0" r="0.5" fill="#e09f5c" />
        </g>
      )}

      {/* Glasses overlay */}
      <MoleGlasses kind={c.glasses} />

      {/* Hat overlay */}
      <MoleHat kind={c.hat} />
    </svg>
  )
}

// Eye expressions by pose
function MoleEyes({ pose }) {
  const stroke = '#1a1a1a'
  switch (pose) {
    case 'sleepy':
      return <g stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M 36 42 Q 40 45 44 42" /><path d="M 56 42 Q 60 45 64 42" />
      </g>
    case 'happy':
      return <g stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M 36 44 Q 40 40 44 44" /><path d="M 56 44 Q 60 40 64 44" />
      </g>
    case 'wink':
      return <g>
        <circle cx="40" cy="42" r="2.5" fill={stroke} /><circle cx="39" cy="41" r="0.8" fill="#fff" />
        <path d="M 56 42 Q 60 45 64 42" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    case 'excited':
      return <g>
        <circle cx="40" cy="42" r="3" fill={stroke} /><circle cx="38.8" cy="40.8" r="1" fill="#fff" />
        <circle cx="60" cy="42" r="3" fill={stroke} /><circle cx="58.8" cy="40.8" r="1" fill="#fff" />
      </g>
    case 'curious':
      return <g>
        <circle cx="40" cy="42" r="3.5" fill={stroke} /><circle cx="38.5" cy="40.5" r="1.2" fill="#fff" />
        <circle cx="60" cy="42" r="2" fill={stroke} />
      </g>
    case 'derpy':
      return <g>
        <circle cx="38" cy="41" r="2.5" fill={stroke} />
        <circle cx="62" cy="43" r="2.5" fill={stroke} />
      </g>
    case 'zen':
      return <g stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round">
        <line x1="35" y1="42" x2="45" y2="42" /><line x1="55" y1="42" x2="65" y2="42" />
      </g>
    case 'sparkle':
      return <g>
        <path d="M 40 42 L 42 40 L 44 42 L 42 44 Z" fill="#ffd54f" />
        <path d="M 60 42 L 62 40 L 64 42 L 62 44 Z" fill="#ffd54f" />
      </g>
    case 'brave':
      return <g>
        <circle cx="40" cy="42" r="2.5" fill={stroke} /><line x1="35" y1="38" x2="45" y2="40" stroke={stroke} strokeWidth="1.5" />
        <circle cx="60" cy="42" r="2.5" fill={stroke} /><line x1="55" y1="40" x2="65" y2="38" stroke={stroke} strokeWidth="1.5" />
      </g>
    case 'shy':
    default:
      return <g stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M 36 43 Q 40 41 44 43" /><path d="M 56 43 Q 60 41 64 43" />
      </g>
  }
}

function MoleMouth({ pose }) {
  const stroke = '#1a1a1a'
  if (pose === 'happy' || pose === 'excited' || pose === 'sparkle') {
    return <path d="M 46 60 Q 50 64 54 60" stroke={stroke} strokeWidth="1.5" fill="#c14765" strokeLinecap="round" />
  }
  if (pose === 'derpy') {
    return <g><path d="M 46 60 L 54 60" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="52" cy="62" rx="3" ry="2" fill="#ff6b8a" /></g>
  }
  if (pose === 'zen' || pose === 'sleepy') {
    return <path d="M 47 60 Q 50 58 53 60" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" />
  }
  return <path d="M 47 60 Q 50 62 53 60" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" />
}

function MoleGlasses({ kind }) {
  if (!kind || kind === 'none') return null
  const frame = '#1a1a1a'
  switch (kind) {
    case 'round':
      return <g fill="none" stroke={frame} strokeWidth="2">
        <circle cx="40" cy="42" r="7" /><circle cx="60" cy="42" r="7" />
        <line x1="47" y1="42" x2="53" y2="42" />
      </g>
    case 'square':
      return <g fill="none" stroke={frame} strokeWidth="2">
        <rect x="33" y="36" width="14" height="12" rx="1.5" />
        <rect x="53" y="36" width="14" height="12" rx="1.5" />
        <line x1="47" y1="42" x2="53" y2="42" />
      </g>
    case 'stars':
      return <g fill="none" stroke="#ff4081" strokeWidth="1.8">
        <path d="M 40 35 L 42 40 L 47 40 L 43 43 L 45 48 L 40 45 L 35 48 L 37 43 L 33 40 L 38 40 Z" fill="#ff408166" />
        <path d="M 60 35 L 62 40 L 67 40 L 63 43 L 65 48 L 60 45 L 55 48 L 57 43 L 53 40 L 58 40 Z" fill="#ff408166" />
      </g>
    case 'sun':
      return <g>
        <rect x="32" y="37" width="16" height="10" rx="2" fill="#1a1a1a" />
        <rect x="52" y="37" width="16" height="10" rx="2" fill="#1a1a1a" />
        <line x1="48" y1="42" x2="52" y2="42" stroke="#1a1a1a" strokeWidth="2" />
      </g>
    case 'monocle':
      return <g fill="none" stroke={frame} strokeWidth="2">
        <circle cx="60" cy="42" r="7" />
        <line x1="60" y1="49" x2="62" y2="58" />
      </g>
    default: return null
  }
}

function MoleHat({ kind }) {
  if (!kind || kind === 'none') return null
  switch (kind) {
    case 'beanie':
      return <g>
        <path d="M 28 24 Q 50 8 72 24 L 72 28 L 28 28 Z" fill="#e53935" />
        <rect x="27" y="26" width="46" height="5" rx="1" fill="#c62828" />
        <circle cx="50" cy="10" r="4" fill="#fff" />
      </g>
    case 'party':
      return <g>
        <path d="M 50 4 L 62 26 L 38 26 Z" fill="#42a5f5" />
        <circle cx="44" cy="14" r="1.5" fill="#ffeb3b" />
        <circle cx="54" cy="18" r="1.5" fill="#ff4081" />
        <circle cx="50" cy="22" r="1.5" fill="#66bb6a" />
        <circle cx="50" cy="4" r="2.5" fill="#fff" />
      </g>
    case 'tophat':
      return <g>
        <rect x="30" y="24" width="40" height="3" fill="#1a1a1a" />
        <rect x="36" y="6" width="28" height="20" fill="#1a1a1a" />
        <rect x="36" y="16" width="28" height="3" fill="#e53935" />
      </g>
    case 'flower':
      return <g>
        <circle cx="30" cy="24" r="4" fill="#ffeb3b" />
        <circle cx="26" cy="22" r="3" fill="#ff4081" />
        <circle cx="34" cy="22" r="3" fill="#ff4081" />
        <circle cx="30" cy="18" r="3" fill="#ff4081" />
        <circle cx="30" cy="24" r="2" fill="#ffeb3b" />
      </g>
    case 'leaf':
      return <g>
        <path d="M 40 25 Q 50 8 62 25 Q 50 20 40 25 Z" fill="#66bb6a" />
        <line x1="50" y1="25" x2="50" y2="12" stroke="#388e3c" strokeWidth="1.5" />
      </g>
    default: return null
  }
}

// shade a hex string (no #) by a factor (-1 to 1)
function shadeHex(hex, factor) {
  const n = parseInt(hex, 16)
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  if (factor < 0) { r = Math.round(r * (1 + factor)); g = Math.round(g * (1 + factor)); b = Math.round(b * (1 + factor)) }
  else { r = Math.round(r + (255 - r) * factor); g = Math.round(g + (255 - g) * factor); b = Math.round(b + (255 - b) * factor) }
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// ═════════════════════════════════════════════════════════════
// CUTE MOLE AVATAR — rendered from an avatarConfig (or derived from name)
// ═════════════════════════════════════════════════════════════
function MoleAvatar({ config, name, size = 48 }) {
  const cfg = config || defaultAvatarConfig(name || 'Mole')
  return (
    <div className="mole-avatar" style={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', overflow: 'hidden' }}>
      <MoleCharacter config={cfg} size={size} />
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// AVATAR BUILDER — pick a pose, fur, nose, glasses, hat, extras
// ═════════════════════════════════════════════════════════════
function AvatarBuilder({ config, onChange, onClose }) {
  function set(patch) { onChange({ ...config, ...patch }) }
  function toggleExtra(id) {
    const has = config.extras?.includes(id)
    set({ extras: has ? config.extras.filter(f => f !== id) : [...(config.extras || []), id] })
  }
  return (
    <div className="avatar-builder">
      <div className="ab-preview">
        <MoleCharacter config={config} size={112} />
      </div>

      <div className="ab-section">
        <label className="ab-label">Pick your mole buddy</label>
        <div className="ab-types-grid">
          {MOLE_POSES.map(t => (
            <button key={t.id} type="button"
              className={`ab-type ${config.pose === t.id ? 'active' : ''}`}
              onClick={() => set({ pose: t.id })} title={t.label}>
              <MoleCharacter config={{ ...config, pose: t.id }} size={48} />
            </button>
          ))}
        </div>
      </div>

      <div className="ab-section">
        <label className="ab-label">Fur Color</label>
        <div className="ab-swatch-row">
          {FUR_COLORS.map(c => (
            <button key={c.id} type="button"
              className={`ab-swatch ${config.furColor === c.id ? 'active' : ''}`}
              style={{ background: `#${c.id}` }}
              onClick={() => set({ furColor: c.id })}
              title={c.label} />
          ))}
        </div>
      </div>

      <div className="ab-section">
        <label className="ab-label">Nose</label>
        <div className="ab-swatch-row">
          {NOSE_COLORS.map(c => (
            <button key={c.id} type="button"
              className={`ab-swatch ${config.noseColor === c.id ? 'active' : ''}`}
              style={{ background: `#${c.id}` }}
              onClick={() => set({ noseColor: c.id })}
              title={c.label} />
          ))}
        </div>
      </div>

      <div className="ab-section">
        <label className="ab-label">Glasses</label>
        <div className="ab-types-grid">
          {MOLE_GLASSES.map(g => (
            <button key={g.id} type="button"
              className={`ab-type ${config.glasses === g.id ? 'active' : ''}`}
              onClick={() => set({ glasses: g.id })} title={g.label}>
              {g.id === 'none'
                ? <span className="ab-none">None</span>
                : <MoleCharacter config={{ ...config, glasses: g.id }} size={48} />}
            </button>
          ))}
        </div>
      </div>

      <div className="ab-section">
        <label className="ab-label">Hat</label>
        <div className="ab-types-grid">
          {MOLE_HATS.map(h => (
            <button key={h.id} type="button"
              className={`ab-type ${config.hat === h.id ? 'active' : ''}`}
              onClick={() => set({ hat: h.id })} title={h.label}>
              {h.id === 'none'
                ? <span className="ab-none">None</span>
                : <MoleCharacter config={{ ...config, hat: h.id }} size={48} />}
            </button>
          ))}
        </div>
      </div>

      <div className="ab-section">
        <label className="ab-label">Extras</label>
        <div className="ab-chips">
          {MOLE_EXTRAS.map(f => (
            <button key={f.id} type="button"
              className={`ab-chip ${config.extras?.includes(f.id) ? 'active' : ''}`}
              onClick={() => toggleExtra(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// SHARE BUTTON
// ═════════════════════════════════════════════════════════════
function ShareButton({ measurements, classification, name }) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  function buildMessage() {
    const ms = measurements || {}
    const lines = [
      `🪙 A Penny For Cancer — Mole Report`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Mole: ${name || 'Unnamed'}`,
      ms.mole_diameter_mm ? `Diameter: ${ms.mole_diameter_mm} mm` : '',
      ms.mole_area_sq_mm ? `Area: ${ms.mole_area_sq_mm} mm²` : '',
      classification ? `AI Comparison with 2,000 Real Examples of Cancer and False Positives: ${classification.label === 'yes' ? '⚠️ Suspicious' : '✅ Likely Benign'} (${classification.confidence}% confidence)` : '',
      ``,
      classification?.label === 'yes'
        ? `⚠️ This mole was flagged as suspicious when compared against 2,000+ dermoscopic samples from the Stanford MIDAS database. Please consider consulting a dermatologist.`
        : `This mole was compared against 2,000+ dermoscopic samples from the Stanford MIDAS database using AI classification.`,
      ``,
      `🔗 Try it yourself: https://penny-for-cancer.vercel.app`,
      ``,
      `⚕️ Not a medical diagnosis. Always consult a qualified dermatologist.`
    ]
    return lines.filter(l => l !== '').join('\n')
  }

  async function handleShare(method) {
    const msg = buildMessage()
    if (method === 'native' && navigator.share) {
      try {
        await navigator.share({ title: 'A Penny For Cancer — Mole Report', text: msg })
      } catch {}
    } else if (method === 'email') {
      const subject = encodeURIComponent('A Penny For Cancer — Mole Report')
      const body = encodeURIComponent(msg)
      window.open(`mailto:?subject=${subject}&body=${body}`)
    } else if (method === 'copy') {
      await navigator.clipboard.writeText(msg)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
    setShowMenu(false)
  }

  return (
    <div className="share-container">
      <button className="btn btn-share" onClick={() => setShowMenu(!showMenu)}>
        <ShareIcon /> Share Results
      </button>
      {showMenu && (
        <div className="share-menu">
          <button onClick={() => handleShare('copy')} className="share-option">
            📋 {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button onClick={() => handleShare('email')} className="share-option">
            📧 Email to a Doctor
          </button>
          {navigator.share && (
            <button onClick={() => handleShare('native')} className="share-option">
              📱 Share with a Friend
            </button>
          )}
        </div>
      )}
    </div>
  )
}


// ═════════════════════════════════════════════════════════════
// MAIN APP — page router: 'home' | 'new' | 'existing'
// ═════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState('home')
  const [image, setImage] = useState(null)
  const [moles, setMoles] = useState([])
  const [measurements, setMeasurements] = useState(null)
  const [pennyData, setPennyData] = useState(null)
  const [paintSettings, setPaintSettings] = useState({
    tool: 'brush', brushSize: 14, color: '#ff1744', opacity: 50, clearToken: 0
  })
  const [status, setStatus] = useState({ type: '', msg: '' })
  const [maskPixelCount, setMaskPixelCount] = useState(0)
  const [classification, setClassification] = useState(null)
  const [cropImageDataUrl, setCropImageDataUrl] = useState(null)
  const [selectedMole, setSelectedMole] = useState(null)
  const [abcAnalysis, setAbcAnalysis] = useState(null)
  // Flow: 'target' (mobile tap-to-crop) → 'paint' → 'name' → 'results'
  const [flowStep, setFlowStep] = useState('paint')
  const [cropRect, setCropRect] = useState(null) // { x, y, size } in original-image coords
  // Form state lives here so ResultsPage can read it after detection
  const [moleName, setMoleName] = useState('')
  const [moleDate, setMoleDate] = useState(new Date().toISOString().split('T')[0])
  const [moleNotes, setMoleNotes] = useState('')
  const [moleAvatarConfig, setMoleAvatarConfig] = useState(() => defaultAvatarConfig('new-mole'))
  const maskCanvasRef = useRef(null)
  const imgCanvasRef = useRef(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    try { const r = await fetch(`${API}/api/moles`); setMoles(await r.json()) } catch {}
  }

  function resetFormState() {
    setMoleName(''); setMoleNotes(''); setMoleDate(new Date().toISOString().split('T')[0])
    setMoleAvatarConfig(defaultAvatarConfig('new-mole'))
    setAbcAnalysis(null)
  }

  function goHome() {
    setPage('home'); setImage(null); setMeasurements(null)
    setPennyData(null); setClassification(null); setCropImageDataUrl(null); setSelectedMole(null)
    setFlowStep('paint'); setCropRect(null)
    resetFormState()
    setStatus({ type: '', msg: '' })
  }

  function startNew() { setSelectedMole(null); resetFormState(); setPage('new') }

  function startExisting() { setPage('existing') }

  function selectMoleAndAnalyze(m) {
    setSelectedMole(m); setImage(null); setMeasurements(null)
    setPennyData(null); setClassification(null); setCropImageDataUrl(null)
    setFlowStep('paint'); setCropRect(null)
    setMoleName(m.name || '')
    setMoleAvatarConfig(m.avatar_config || defaultAvatarConfig(m.name))
    setMoleNotes(''); setMoleDate(new Date().toISOString().split('T')[0])
    setAbcAnalysis(null)
    setStatus({ type: '', msg: '' }); setPage('new')
  }

  function isMobileViewport() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  }

  // Resize image to fit within maxDim and return base64 JPEG (keeps payload under Vercel's 4.5MB limit)
  function compressImage(file, maxDim = 1600) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        let cw = img.width, ch = img.height
        let scaleBack = 1 // scale factor to convert Roboflow coords back to original
        if (cw > maxDim || ch > maxDim) {
          const scale = maxDim / Math.max(cw, ch)
          cw = Math.round(cw * scale); ch = Math.round(ch * scale)
          scaleBack = img.width / cw // e.g. 4032/1600 = 2.52
        }
        const canvas = document.createElement('canvas')
        canvas.width = cw; canvas.height = ch
        canvas.getContext('2d').drawImage(img, 0, 0, cw, ch)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const b64 = dataUrl.split(',')[1]
        resolve({ b64, width: img.width, height: img.height, url, scaleBack })
      }
      img.src = url
    })
  }

  async function handleUpload(file) {
    setStatus({ type: 'loading', msg: 'Uploading...' })
    setMeasurements(null); setPennyData(null); setClassification(null); setCropImageDataUrl(null)
    setCropRect(null)
    try {
      // Compress image for API calls (keeps under Vercel body size limit)
      const { b64, width, height, url, scaleBack } = await compressImage(file)
      setImage({ filename: file.name, width, height, url, base64: b64, scaleBack: scaleBack || 1 })
      if (isMobileViewport()) {
        setFlowStep('target')
        setStatus({ type: 'info', msg: 'Tap the center of your mole to zoom in.' })
      } else {
        setFlowStep('paint')
        setStatus({ type: 'success', msg: 'Image loaded. Paint over the mole, then click Detect.' })
      }
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
  }

  // Called from CanvasEditor tap-target overlay on mobile
  function handleTapTarget(tapX, tapY, imgW, imgH) {
    // Window size: ~25% of the shorter image side, clamped to 280–600px. Gives a nice zoom for phones.
    const side = Math.min(imgW, imgH)
    const size = Math.max(280, Math.min(600, Math.round(side * 0.28)))
    const x = Math.max(0, Math.min(Math.round(tapX - size / 2), imgW - size))
    const y = Math.max(0, Math.min(Math.round(tapY - size / 2), imgH - size))
    setCropRect({ x, y, size })
    setFlowStep('paint')
    setStatus({ type: 'success', msg: 'Now paint over the mole in the zoomed view.' })
  }

  // Crop mole region from canvas and return { dataUrl, base64 }
  function cropMoleImage() {
    const mc = maskCanvasRef.current, ic = imgCanvasRef.current
    if (!mc || !ic) return null
    const maskData = mc.getContext('2d').getImageData(0, 0, mc.width, mc.height).data
    let minX = mc.width, minY = mc.height, maxX = 0, maxY = 0
    for (let y = 0; y < mc.height; y++)
      for (let x = 0; x < mc.width; x++)
        if (maskData[(y * mc.width + x) * 4 + 3] > 0) {
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
    if (maxX <= minX || maxY <= minY) return null
    const pad = 20
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
    maxX = Math.min(mc.width, maxX + pad); maxY = Math.min(mc.height, maxY + pad)
    const w = maxX - minX, h = maxY - minY, side = Math.max(w, h)
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    const cropX = Math.max(0, Math.round(cx - side / 2))
    const cropY = Math.max(0, Math.round(cy - side / 2))
    const cropSize = Math.min(side, mc.width - cropX, mc.height - cropY)
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = cropSize; cropCanvas.height = cropSize
    cropCanvas.getContext('2d').drawImage(ic, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize)
    const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.9)
    const b64 = dataUrl.split(',')[1]
    return { dataUrl, b64 }
  }

  async function handleDetect() {
    const count = countMaskPixels()
    if (count < 50) { setStatus({ type: 'error', msg: 'Paint over the mole first.' }); return }
    setMaskPixelCount(count)
    setStatus({ type: 'loading', msg: 'Running Roboflow penny detection...' })
    setMeasurements(null); setClassification(null); setCropImageDataUrl(null); setAbcAnalysis(null)

    // A/B/C analysis — run locally on the mask + image
    const abc = analyzeABC()
    if (abc) setAbcAnalysis(abc)
    try {
      // Step 1: Detect penny — call Roboflow directly from browser (avoids Cloudflare blocking serverless IPs)
      const pennyResult = await callRoboflowWorkflow(RF_PENNY_WORKFLOW, image.base64)
      console.log('=== PENNY DETECT RESPONSE ===', JSON.stringify(pennyResult, null, 2))
      const pennyArea = extractPennyArea(pennyResult)
      if (!pennyArea) throw new Error('No penny detected. Raw response: ' + JSON.stringify(pennyResult).slice(0, 300))
      setPennyData(pennyArea)

      // Step 2: Calculate measurements
      // IMPORTANT: penny area is in compressed-image pixels, mole mask is in original-image pixels
      // Scale penny area to original resolution: area scales as (scaleBack)^2
      const PENNY_AREA_SQ_IN = 0.448
      const s = image.scaleBack || 1
      const pennyAreaOrigScale = pennyArea.area * s * s
      console.log(`Penny area: ${pennyArea.area}px (compressed) → ${Math.round(pennyAreaOrigScale)}px (original scale, scaleBack=${s})`)
      const sqInPerPx = PENNY_AREA_SQ_IN / pennyAreaOrigScale
      const moleAreaIn = count * sqInPerPx
      const moleAreaMm = moleAreaIn * 645.16
      const moleDiamIn = 2 * Math.sqrt(moleAreaIn / Math.PI)
      const moleDiamMm = moleDiamIn * 25.4
      const calcResult = {
        penny_pixel_area: Math.round(pennyAreaOrigScale),
        mole_pixel_count: count,
        mole_area_sq_inches: Math.round(moleAreaIn * 10000) / 10000,
        mole_area_sq_mm: Math.round(moleAreaMm * 100) / 100,
        mole_diameter_inches: Math.round(moleDiamIn * 10000) / 10000,
        mole_diameter_mm: Math.round(moleDiamMm * 100) / 100,
      }
      setMeasurements(calcResult)
      setStatus({ type: 'loading', msg: 'Comparing against 2,000+ Stanford MIDAS samples...' })

      // Step 3: Auto-run classification — also direct from browser
      const crop = cropMoleImage()
      if (crop) {
        setCropImageDataUrl(crop.dataUrl)
        try {
          const clsResult = await callRoboflowWorkflow(RF_CLASSIFY_WORKFLOW, crop.b64)
          console.log('=== CLASSIFY RESPONSE ===', JSON.stringify(clsResult, null, 2))
          const prediction = parseClassification(clsResult)
          setClassification(prediction)
          setStatus({ type: 'success', msg: 'Measurement & AI screening complete!' })
        } catch (clsErr) {
          console.warn('Classification failed:', clsErr)
          setStatus({ type: 'success', msg: 'Measurement complete. AI screening unavailable.' })
        }
      } else {
        setStatus({ type: 'success', msg: 'Measurement complete!' })
      }
      // Advance to full-page results view
      setFlowStep('results')
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
  }

  async function handleSave() {
    const saveName = moleName || 'Unnamed'
    try {
      await fetch(`${API}/api/moles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName, date: moleDate, notes: moleNotes,
          image_filename: image.filename,
          mask_pixel_count: maskPixelCount,
          measurements,
          classification: classification ? {
            label: classification.label,
            confidence: classification.confidence,
          } : null,
          crop_image: cropImageDataUrl || null,
          avatar_config: moleAvatarConfig || null,
          abc_analysis: abcAnalysis || null,
        }),
      })
      setStatus({ type: 'success', msg: `Saved "${saveName}"! 🎉` }); loadHistory()
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this mole record? This cannot be undone.')) return
    await fetch(`${API}/api/moles?id=${id}`, { method: 'DELETE' }); loadHistory()
  }

  function countMaskPixels() {
    const c = maskCanvasRef.current; if (!c) return 0
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++
    return n
  }

  // ABC analysis — asymmetry, border irregularity, color variance — all client-side from mask + image.
  function analyzeABC() {
    const mc = maskCanvasRef.current, ic = imgCanvasRef.current
    if (!mc || !ic) return null
    const w = mc.width, h = mc.height
    const mData = mc.getContext('2d').getImageData(0, 0, w, h).data
    const iData = ic.getContext('2d').getImageData(0, 0, w, h).data

    // Pass 1: bounding box + centroid + count
    let minX = w, maxX = 0, minY = h, maxY = 0
    let sumX = 0, sumY = 0, count = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (mData[(y * w + x) * 4 + 3] > 0) {
        sumX += x; sumY += y; count++
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
    if (count < 30) return null
    const cx = sumX / count, cy = sumY / count

    // Asymmetry: fold across vertical and horizontal centroid axes, count mismatched pixels
    let vMismatch = 0, hMismatch = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const here = mData[(y * w + x) * 4 + 3] > 0
      const rx = Math.round(2 * cx - x)
      if (rx >= 0 && rx < w) {
        const thereV = mData[(y * w + rx) * 4 + 3] > 0
        if (here !== thereV) vMismatch++
      }
      const ry = Math.round(2 * cy - y)
      if (ry >= 0 && ry < h) {
        const thereH = mData[(ry * w + x) * 4 + 3] > 0
        if (here !== thereH) hMismatch++
      }
    }
    // Normalize: mismatch count / (2 * area). Max asymmetry between the two axes.
    const asymmetry = Math.min(1, Math.max(vMismatch, hMismatch) / (2 * count))

    // Border: circularity = 4πA / P². 1 = perfect circle, lower = more irregular.
    let perimeter = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (mData[(y * w + x) * 4 + 3] > 0) {
        const up = y > 0 && mData[((y - 1) * w + x) * 4 + 3] > 0
        const dn = y < h - 1 && mData[((y + 1) * w + x) * 4 + 3] > 0
        const lf = x > 0 && mData[(y * w + (x - 1)) * 4 + 3] > 0
        const rt = x < w - 1 && mData[(y * w + (x + 1)) * 4 + 3] > 0
        if (!(up && dn && lf && rt)) perimeter++
      }
    }
    const circularity = perimeter > 0 ? Math.min(1, (4 * Math.PI * count) / (perimeter * perimeter)) : 1
    const borderIrregularity = 1 - circularity

    // Color variance: RGB stddev within the painted mask
    let sumR = 0, sumG = 0, sumB = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (mData[i + 3] > 0) { sumR += iData[i]; sumG += iData[i + 1]; sumB += iData[i + 2] }
    }
    const meanR = sumR / count, meanG = sumG / count, meanB = sumB / count
    let varSum = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (mData[i + 3] > 0) {
        const dr = iData[i] - meanR, dg = iData[i + 1] - meanG, db = iData[i + 2] - meanB
        varSum += dr * dr + dg * dg + db * db
      }
    }
    const colorStddev = Math.sqrt(varSum / (count * 3))

    // Score each (low / moderate / high) — thresholds are heuristic, not medical
    const asymLevel = asymmetry < 0.15 ? 'low' : asymmetry < 0.30 ? 'moderate' : 'high'
    const borderLevel = borderIrregularity < 0.25 ? 'smooth' : borderIrregularity < 0.50 ? 'irregular' : 'jagged'
    const colorLevel = colorStddev < 20 ? 'uniform' : colorStddev < 40 ? 'mixed' : 'variable'

    return {
      asymmetry: Math.round(asymmetry * 1000) / 10, // %
      asymmetryLevel: asymLevel,
      borderIrregularity: Math.round(borderIrregularity * 1000) / 10,
      borderLevel,
      colorStddev: Math.round(colorStddev * 10) / 10,
      colorLevel,
    }
  }

  return (
    <div className="app">
      <header className="app-header" onClick={goHome} style={{ cursor: 'pointer' }}>
        <img src="/penny.png" alt="Penny" className="header-penny" />
        <h1>A Penny <span>For Cancer</span></h1>
        <p className="header-tagline">Measure moles using a penny for scale</p>
      </header>

      <PaintContext.Provider value={{ paintSettings, setPaintSettings }}>
        {page === 'home' && (
          <HomePage
            moles={moles}
            onNew={startNew}
            onExisting={startExisting}
            onSelectMole={selectMoleAndAnalyze}
            onDelete={handleDelete}
          />
        )}

        {page === 'existing' && (
          <ExistingMolePage
            moles={moles}
            onSelect={selectMoleAndAnalyze}
            onDelete={handleDelete}
            onBack={goHome}
          />
        )}

        {page === 'new' && flowStep === 'results' && (
          <ResultsPage
            name={moleName} setName={setMoleName}
            date={moleDate} setDate={setMoleDate}
            notes={moleNotes} setNotes={setMoleNotes}
            avatarConfig={moleAvatarConfig} setAvatarConfig={setMoleAvatarConfig}
            measurements={measurements}
            classification={classification}
            analysis={abcAnalysis}
            cropImageDataUrl={cropImageDataUrl}
            selectedMole={selectedMole}
            status={status}
            onSave={handleSave}
            onRedo={() => setFlowStep('paint')}
            onStartOver={goHome}
          />
        )}

        {page === 'new' && flowStep !== 'results' && (
          <div className="app-layout">
            <aside className="sidebar">
              <div className="sidebar-section">
                <button className="btn btn-outline" onClick={goHome}>&larr; Back to Home</button>
              </div>
              <UploadSection onUpload={handleUpload} />
              {image && flowStep === 'target' && (
                <div className="sidebar-section">
                  <h3>Step 1 of 3</h3>
                  <p style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.5 }}>
                    Tap the <strong style={{ color: '#f9a825' }}>center of your mole</strong> in the photo. We&rsquo;ll zoom in so you can paint it precisely.
                  </p>
                  {status.msg && <div className={`status-bar ${status.type}`}>{status.msg}</div>}
                </div>
              )}
              {image && flowStep === 'paint' && (
                <>
                  <PaintToolbar />
                  <div className="sidebar-section">
                    <button className="btn btn-primary btn-done-labeling" onClick={handleDetect}>
                      {status.type === 'loading' ? <><span className="spinner" />{status.msg || 'Analyzing…'}</> : <>✓ Done Labeling</>}
                    </button>
                    {status.msg && status.type === 'error' && <div className={`status-bar ${status.type}`} style={{ marginTop: 8 }}>{status.msg}</div>}
                    <p className="paint-hint-done">
                      When you&rsquo;re happy with your painted mask, tap Done Labeling. We&rsquo;ll measure, screen, and reveal your mole buddy.
                    </p>
                  </div>
                </>
              )}
            </aside>
            <main className="canvas-area">
              {!image ? (
                <div className="placeholder">
                  <img src="/penny.png" alt="Penny" style={{ width: 72, height: 72, borderRadius: '50%' }} />
                  <h2>{selectedMole ? `Re-measuring: ${selectedMole.name}` : 'New Mole Analysis'}</h2>
                  <p>Upload or capture a photo with a penny placed next to the mole.</p>
                </div>
              ) : (
                <CanvasEditor
                  image={image}
                  maskCanvasRef={maskCanvasRef}
                  imgCanvasRef={imgCanvasRef}
                  pennyData={pennyData}
                  flowStep={flowStep}
                  cropRect={cropRect}
                  onTapTarget={handleTapTarget}
                />
              )}
            </main>
          </div>
        )}
      </PaintContext.Provider>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// HOME PAGE
// ═════════════════════════════════════════════════════════════
function HomePage({ moles, onNew, onExisting, onSelectMole, onDelete }) {
  const recent = [...moles].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10)

  const grouped = {}
  moles.forEach(m => {
    const key = m.name || 'Unnamed'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  })
  const moleCount = Object.keys(grouped).length

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="home-hero">
        <div className="hero-icon">
          <img src="/penny.png" alt="Penny" className="hero-penny" />
        </div>
        <h2>Welcome to A Penny For Cancer</h2>
        <p className="hero-subtitle mission">
          The penny is dead, and of the 300 billion still out there in circulation, some 60% go unused, so to my small denominated friend, here&rsquo;s your chance to shine once again. The penny will be used to provide a reference object to determine the area and diameter of the mole. And this should be obvious, but this is a silly project &mdash; <strong>if you are concerned, go to the doctor, please!</strong>
        </p>
      </section>

      {/* Action Buttons */}
      <section className="home-actions">
        <button className="action-card new-card" onClick={onNew}>
          <div className="action-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <h3>New Mole Analysis</h3>
          <p>Upload a new photo with a penny for scale, label the mole with the brush tool, and get an instant size measurement + AI screening.</p>
        </button>

        <button className="action-card existing-card" onClick={onExisting}>
          <div className="action-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <h3>Existing Mole Analysis</h3>
          <p>Select a previously measured mole, take a new photo, and compare to detect growth &mdash; flagged if area increases 20%+.</p>
          {moleCount > 0 && <span className="action-badge">{moleCount} mole{moleCount !== 1 ? 's' : ''} tracked</span>}
        </button>
      </section>

      {/* Recent Measurements */}
      <section className="home-section">
        <h3>Recent Measurements</h3>
        {recent.length === 0 ? (
          <div className="empty-state">
            <p className="muted">No measurements yet — your mole tracker starts here.</p>
            <button className="btn btn-primary" onClick={onNew} style={{ width: 'auto', marginTop: 12 }}>✨ Analyze Your First Mole</button>
          </div>
        ) : (
          <div className="recent-table">
            <div className="recent-header">
              <span></span><span>Name</span><span>Date</span><span>Diameter</span><span>AI Comparison</span><span></span>
            </div>
            {recent.map(m => {
              const ms = m.measurements || {}
              const cls = m.classification
              return (
                <div key={m.id} className="recent-row">
                  <span className="recent-avatar">
                    <MoleAvatar config={m.avatar_config} name={m.name || 'Mole'} size={36} />
                  </span>
                  <span className="recent-name">{m.name}</span>
                  <span className="recent-date">{m.date}</span>
                  <span className={`recent-diam ${ms.mole_diameter_mm >= 6 ? 'danger' : ms.mole_diameter_mm >= 4 ? 'warn' : 'safe'}`}>
                    {ms.mole_diameter_mm ? `${ms.mole_diameter_mm} mm` : '—'}
                  </span>
                  <span className={`recent-cls ${cls?.label === 'yes' ? 'cls-flag' : cls?.label === 'no' ? 'cls-ok' : ''}`}>
                    {cls ? (
                      <>{cls.label === 'yes' ? '⚠️' : '✅'} {cls.confidence}%</>
                    ) : '—'}
                  </span>
                  <span className="recent-actions">
                    <button className="link-btn" onClick={() => onSelectMole(m)}>Re-measure</button>
                    <button className="link-btn danger-link" onClick={() => onDelete(m.id)}>&times;</button>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ABCDE Education */}
      <section className="home-section abcde-section">
        <h3>The ABCDE Rule of Melanoma Detection</h3>
        <p className="section-intro">Dermatologists use the ABCDE rule to evaluate whether a mole may be melanoma. Learn these five warning signs:</p>
        <div className="abcde-grid">
          <div className="abcde-card">
            <div className="abcde-letter">A</div>
            <h4>Asymmetry</h4>
            <p>One half of the mole does not match the other half. Benign moles are typically symmetrical.</p>
          </div>
          <div className="abcde-card">
            <div className="abcde-letter">B</div>
            <h4>Border</h4>
            <p>The edges are irregular, ragged, notched, or blurred rather than smooth and well-defined.</p>
          </div>
          <div className="abcde-card">
            <div className="abcde-letter">C</div>
            <h4>Color</h4>
            <p>The color is not uniform. There may be shades of brown, tan, black, red, white, or blue within the mole.</p>
          </div>
          <div className="abcde-card">
            <div className="abcde-letter">D</div>
            <h4>Diameter</h4>
            <p>The mole is larger than 6mm (about the size of a pencil eraser). <strong>This is exactly what A Penny For Cancer measures.</strong></p>
          </div>
          <div className="abcde-card">
            <div className="abcde-letter">E</div>
            <h4>Evolving</h4>
            <p>The mole is changing in size, shape, or color over time. <strong>Track this with our re-measurement tool.</strong></p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <p>Not a medical device. Always consult a qualified dermatologist for clinical evaluation.</p>
      </footer>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// EXISTING MOLE SELECTION PAGE
// ═════════════════════════════════════════════════════════════
function ExistingMolePage({ moles, onSelect, onDelete, onBack }) {
  const grouped = {}
  moles.forEach(m => {
    const key = m.name || 'Unnamed'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  })
  const groupEntries = Object.entries(grouped).map(([name, entries]) => {
    entries.sort((a, b) => b.date.localeCompare(a.date))
    return { name, entries }
  }).sort((a, b) => b.entries[0].date.localeCompare(a.entries[0].date))

  function getGrowth(entries, idx) {
    if (idx >= entries.length - 1) return null
    const curr = entries[idx].measurements?.mole_area_sq_mm
    const prev = entries[idx + 1].measurements?.mole_area_sq_mm
    if (!curr || !prev || prev === 0) return null
    return Math.round(((curr - prev) / prev) * 1000) / 10
  }

  return (
    <div className="existing-page">
      <div className="existing-header">
        <button className="btn btn-outline" onClick={onBack}>&larr; Back</button>
        <h2>Select a Mole to Re-measure</h2>
        <p>Choose an existing mole below, then take a new photo to compare size and detect growth.</p>
      </div>

      {groupEntries.length === 0 ? (
        <div className="empty-state">
          <p>No moles tracked yet. Start with a <strong>New Mole Analysis</strong> first.</p>
          <button className="btn btn-primary" onClick={onBack}>&larr; Go Back</button>
        </div>
      ) : (
        <div className="existing-grid">
          {groupEntries.map(({ name, entries }) => {
            const latest = entries[0]
            const ms = latest.measurements || {}
            return (
              <div key={name} className="existing-card" onClick={() => onSelect(latest)}>
                <div className="existing-card-top">
                  <MoleAvatar config={latest.avatar_config} name={name} size={52} />
                  <div className="existing-card-header">
                    <span className="existing-name">{name}</span>
                    <span className="existing-count">{entries.length} record{entries.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
                {latest.crop_image && (
                  <img src={latest.crop_image} alt="" className="existing-crop-thumb" />
                )}
                <div className="existing-stats">
                  {ms.mole_diameter_mm && (
                    <span className={ms.mole_diameter_mm >= 6 ? 'danger' : ms.mole_diameter_mm >= 4 ? 'warn' : 'safe'}>
                      {ms.mole_diameter_mm} mm diameter
                    </span>
                  )}
                  {ms.mole_area_sq_mm && <span>{ms.mole_area_sq_mm} mm&sup2;</span>}
                </div>
                {latest.classification && (
                  <div className={`existing-cls ${latest.classification.label === 'yes' ? 'cls-flag' : 'cls-ok'}`}>
                    {latest.classification.label === 'yes' ? '⚠️ Suspicious' : '✅ Likely Benign'} ({latest.classification.confidence}%)
                  </div>
                )}
                <div className="existing-dates">Last measured: {latest.date}</div>
                {entries.length > 1 && (
                  <div className="existing-history">
                    {entries.slice(0, 4).map((m, idx) => {
                      const g = getGrowth(entries, idx)
                      return (
                        <div key={m.id} className="existing-entry">
                          <span>{m.date}</span>
                          <span>{m.measurements?.mole_area_sq_mm || '—'} mm&sup2;</span>
                          {g !== null && (
                            <span className={`growth-badge ${g >= 20 ? 'growth-badge-danger' : g > 0 ? 'growth-badge-warn' : 'growth-badge-ok'}`}>
                              {g > 0 ? '+' : ''}{g}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="existing-cta">Click to re-measure &rarr;</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// UPLOAD / CAMERA
// ═════════════════════════════════════════════════════════════
function UploadSection({ onUpload }) {
  const fileRef = useRef()
  const videoRef = useRef()
  const [cameraOpen, setCameraOpen] = useState(false)
  const streamRef = useRef(null)

  function handleFile(e) { if (e.target.files[0]) onUpload(e.target.files[0]) }
  function handleDrop(e) { e.preventDefault(); if (e.dataTransfer.files[0]) onUpload(e.dataTransfer.files[0]) }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      streamRef.current = stream; setCameraOpen(true)
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 50)
    } catch (e) { alert('Could not access camera: ' + e.message) }
  }

  function capturePhoto() {
    const video = videoRef.current; if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      onUpload(new File([blob], 'capture.jpg', { type: 'image/jpeg' })); closeCamera()
    }, 'image/jpeg', 0.92)
  }

  function closeCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setCameraOpen(false)
  }

  if (cameraOpen) {
    return (
      <div className="sidebar-section">
        <h3>Camera</h3>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 8 }} />
        <div className="btn-group">
          <button className="btn btn-primary" onClick={capturePhoto}><CameraIcon /> Capture</button>
          <button className="btn btn-outline" onClick={closeCamera}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar-section">
      <h3>Image</h3>
      <div className="upload-area" onClick={() => fileRef.current.click()} onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Upload photo</p>
        <p className="hint">Include a penny for scale</p>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={openCamera}><CameraIcon /> Take Photo</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// PAINT TOOLBAR
// ═════════════════════════════════════════════════════════════
function PaintToolbar() {
  const { paintSettings: ps, setPaintSettings } = useContext(PaintContext)
  const update = (u) => setPaintSettings(prev => ({ ...prev, ...u }))
  return (
    <div className="sidebar-section">
      <h3>Label Your Mole</h3>
      <div className="brush-instructions">
        <p>Use the <strong>brush</strong> to paint over the entire mole or worrisome skin area you want to measure:</p>
        <ul>
          <li><strong>Trace the outline</strong> of the mole along its edges</li>
          <li><strong>Fill in the center</strong> completely &mdash; every painted pixel counts</li>
          <li>Use a <strong>smaller brush</strong> for edges, <strong>larger</strong> to fill</li>
          <li>Switch to the <strong>eraser</strong> to clean up overpaint</li>
          <li>Use <strong>zoom (+/&minus;)</strong> bottom-right for detail work</li>
        </ul>
      </div>
      <div className="paint-tools">
        <button className={`tool-btn ${ps.tool === 'brush' ? 'active' : ''}`} onClick={() => update({ tool: 'brush' })} title="Brush"><BrushIcon /></button>
        <button className={`tool-btn ${ps.tool === 'eraser' ? 'active' : ''}`} onClick={() => update({ tool: 'eraser' })} title="Eraser"><EraserIcon /></button>
        <button className="tool-btn" onClick={() => update({ clearToken: Date.now() })} title="Clear mask"><TrashIcon /></button>
        <input type="color" value={ps.color} onChange={e => update({ color: e.target.value })} className="color-input" />
      </div>
      <div className="slider-row"><span className="slider-label">Brush: {ps.brushSize}px</span>
        <input type="range" min="2" max="60" value={ps.brushSize} onChange={e => update({ brushSize: +e.target.value })} /></div>
      <div className="slider-row"><span className="slider-label">Opacity: {ps.opacity}%</span>
        <input type="range" min="10" max="90" value={ps.opacity} onChange={e => update({ opacity: +e.target.value })} /></div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// CANVAS EDITOR
// ═════════════════════════════════════════════════════════════
function CanvasEditor({ image, maskCanvasRef, imgCanvasRef, pennyData, flowStep, cropRect, onTapTarget }) {
  const containerRef = useRef()
  const painting = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const imgObjRef = useRef(null)
  const { paintSettings: ps } = useContext(PaintContext)
  const psRef = useRef(ps)
  useEffect(() => { psRef.current = ps }, [ps])

  // cropRect is in original-image coords. When set, we draw only that region 1:1 into the canvases.
  const cr = cropRect
  const drawW = cr ? cr.size : null
  const drawH = cr ? cr.size : null

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => {
      imgObjRef.current = img
      const w = cr ? cr.size : img.width, h = cr ? cr.size : img.height
      imgCanvasRef.current.width = w; imgCanvasRef.current.height = h
      maskCanvasRef.current.width = w; maskCanvasRef.current.height = h
      const ctx = imgCanvasRef.current.getContext('2d')
      if (cr) ctx.drawImage(img, cr.x, cr.y, cr.size, cr.size, 0, 0, cr.size, cr.size)
      else ctx.drawImage(img, 0, 0)
      fitCanvas()
    }
    img.src = image.url
  }, [image, cr?.x, cr?.y, cr?.size])

  useEffect(() => {
    if (!pennyData || !imgObjRef.current || cr) return
    // Penny bbox only makes sense when painting on full image (penny is outside the mole crop)
    const ctx = imgCanvasRef.current.getContext('2d')
    ctx.drawImage(imgObjRef.current, 0, 0)
    const bbox = pennyData.bbox
    const s = image.scaleBack || 1
    if (bbox) {
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = Math.max(3, Math.round(3 * s))
      const bx = bbox.x * s, by = bbox.y * s, bw = bbox.width * s, bh = bbox.height * s
      const x = bx - bw / 2, y = by - bh / 2
      ctx.strokeRect(x, y, bw, bh)
      ctx.fillStyle = '#00ff88'; ctx.font = `bold ${Math.max(16, Math.round(16 * s))}px sans-serif`
      ctx.fillText(`Penny (${pennyData.area.toLocaleString()}px)`, x, y - 6 * s)
    } else {
      ctx.fillStyle = '#00ff88'; ctx.font = 'bold 20px sans-serif'
      ctx.fillText(`Penny detected: ${pennyData.area.toLocaleString()}px area`, 10, 30)
    }
  }, [pennyData])

  useEffect(() => {
    if (ps.clearToken && maskCanvasRef.current) {
      maskCanvasRef.current.getContext('2d').clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
    }
  }, [ps.clearToken])

  function fitCanvas() {
    const area = containerRef.current?.parentElement; if (!area || !imgObjRef.current) return
    const r = area.getBoundingClientRect()
    const cw = cr ? cr.size : imgObjRef.current.width
    const ch = cr ? cr.size : imgObjRef.current.height
    const s = Math.min((r.width - 40) / cw, (r.height - 40) / ch, 1)
    const w = Math.round(cw * s) + 'px', h = Math.round(ch * s) + 'px'
    for (const el of [containerRef.current, imgCanvasRef.current, maskCanvasRef.current]) { el.style.width = w; el.style.height = h }
  }

  function getCoords(e) {
    const rect = maskCanvasRef.current.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (cx - rect.left) * (maskCanvasRef.current.width / rect.width), y: (cy - rect.top) * (maskCanvasRef.current.height / rect.height) }
  }

  function stroke(x1, y1, x2, y2) {
    const p = psRef.current, ctx = maskCanvasRef.current.getContext('2d')
    ctx.save()
    if (p.tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = ctx.fillStyle = 'rgba(0,0,0,1)' }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = ctx.fillStyle = p.color }
    ctx.lineWidth = p.brushSize; ctx.lineCap = ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ctx.beginPath(); ctx.arc(x2, y2, p.brushSize / 2, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  function onDown(e) { e.preventDefault(); painting.current = true; const p = getCoords(e); lastPos.current = p; stroke(p.x, p.y, p.x, p.y) }
  function onMove(e) { e.preventDefault(); if (!painting.current) return; const p = getCoords(e); stroke(lastPos.current.x, lastPos.current.y, p.x, p.y); lastPos.current = p }
  function onUp() { painting.current = false }
  function zoom(f) {
    const c = containerRef.current
    const w = Math.round(parseInt(c.style.width) * f) + 'px', h = Math.round(parseInt(c.style.height) * f) + 'px'
    for (const el of [c, imgCanvasRef.current, maskCanvasRef.current]) { el.style.width = w; el.style.height = h }
  }

  // Tap-target mode — user taps mole location on the full image
  function handleTapTarget(e) {
    e.preventDefault()
    const rect = imgCanvasRef.current.getBoundingClientRect()
    const cx = e.touches ? e.changedTouches[0].clientX : e.clientX
    const cy = e.touches ? e.changedTouches[0].clientY : e.clientY
    const canvasX = (cx - rect.left) * (imgCanvasRef.current.width / rect.width)
    const canvasY = (cy - rect.top) * (imgCanvasRef.current.height / rect.height)
    onTapTarget && onTapTarget(canvasX, canvasY, imgObjRef.current.width, imgObjRef.current.height)
  }

  const inTargetMode = flowStep === 'target'

  return (
    <>
      <div className="canvas-container" ref={containerRef}>
        <canvas ref={imgCanvasRef} className="layer-canvas" />
        <canvas ref={maskCanvasRef} className="layer-canvas mask-canvas"
          style={{
            opacity: inTargetMode ? 0 : (ps.opacity / 100),
            cursor: inTargetMode ? 'crosshair' : (ps.tool === 'eraser' ? 'cell' : 'crosshair'),
            pointerEvents: inTargetMode ? 'none' : 'auto',
          }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} />
        {inTargetMode && (
          <div className="tap-target-overlay"
            onClick={handleTapTarget} onTouchEnd={handleTapTarget}>
            <div className="tap-target-hint">
              <div className="tap-target-ring" />
              <div className="tap-target-text">Tap the center of your mole</div>
              <div className="tap-target-sub">We&rsquo;ll zoom in so you can paint precisely</div>
            </div>
          </div>
        )}
      </div>
      <div className="zoom-controls">
        <button onClick={() => zoom(1.25)}>+</button>
        <button onClick={() => zoom(0.8)}>&minus;</button>
        <button onClick={fitCanvas}>Fit</button>
      </div>
    </>
  )
}

// ═════════════════════════════════════════════════════════════
// NAME FORM — step 2: name, avatar builder, date, notes, Detect button
// ═════════════════════════════════════════════════════════════
function NameForm({ name, setName, date, setDate, notes, setNotes, avatarConfig, setAvatarConfig, selectedMole, onClearSelection, onBackToPaint, onDetect, status }) {
  const [showBuilder, setShowBuilder] = useState(false)

  return (
    <div className="sidebar-section">
      <div className="step-header">
        <button type="button" className="step-back" onClick={onBackToPaint}>&larr; Back to labeling</button>
        <span className="step-tag">Step 2 of 3</span>
      </div>
      <h3>{selectedMole ? 'Re-measure Existing Mole' : 'Name Your Mole Buddy'}</h3>
      {selectedMole && (
        <div className="remeasure-banner">
          <div className="remeasure-info">Re-measuring: <strong>{selectedMole.name}</strong>
            <br/><span className="remeasure-prev">Previous: {selectedMole.measurements?.mole_area_sq_mm} mm&sup2; on {selectedMole.date}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClearSelection}>New mole instead</button>
        </div>
      )}

      <div className="name-section">
        <div className="name-row">
          <button type="button" className="name-avatar-preview" onClick={() => setShowBuilder(s => !s)} title="Customize my mole">
            <MoleAvatar config={avatarConfig} size={56} />
          </button>
          <div className="name-input-area">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Mole Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Give it a fun name!" />
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-outline btn-customize" onClick={() => setShowBuilder(s => !s)}>
          {showBuilder ? '✕ Close' : '🎨 Customize My Mole'}
        </button>
        {showBuilder && (
          <AvatarBuilder config={avatarConfig} onChange={setAvatarConfig} onClose={() => setShowBuilder(false)} />
        )}
      </div>

      <div className="field"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="field"><label>Notes</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations..." /></div>
      <button className="btn btn-primary" onClick={onDetect}><SearchIcon /> Detect Penny, Measure &amp; Screen</button>

      {status.msg && <div className={`status-bar ${status.type}`}>{status.type === 'loading' && <span className="spinner" />}{status.msg}</div>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// RESULTS PAGE — reveal animation + inline form + ABCDE + actions
// ═════════════════════════════════════════════════════════════
function ResultsPage({ name, setName, date, setDate, notes, setNotes, avatarConfig, setAvatarConfig, measurements, classification, analysis, cropImageDataUrl, selectedMole, status, onSave, onRedo, onStartOver }) {
  const [showBuilder, setShowBuilder] = useState(false)
  const diamClass = (mm) => mm >= 6 ? 'danger' : mm >= 4 ? 'warn' : 'safe'

  const growthInfo = selectedMole && measurements && selectedMole.measurements ? (() => {
    const oldArea = selectedMole.measurements.mole_area_sq_mm, newArea = measurements.mole_area_sq_mm
    if (!oldArea || oldArea === 0) return null
    return { oldArea, newArea, pctChange: Math.round(((newArea - oldArea) / oldArea) * 1000) / 10 }
  })() : null

  const isSaved = status?.type === 'success' && status?.msg?.startsWith('Saved')
  const saveLabel = name || 'Unnamed'

  return (
    <div className="results-page">
      {/* BIG REVEAL ANIMATION */}
      <div className="reveal-stage">
        <div className="reveal-sparkles">
          {[...Array(10)].map((_, i) => (
            <span key={i} className={`sparkle sparkle-${i}`}>✦</span>
          ))}
        </div>
        <div className="reveal-hole">
          <div className="reveal-dirt">
            {[...Array(8)].map((_, i) => <span key={i} className={`dirt-bit dirt-bit-${i}`} />)}
          </div>
          <div className="reveal-mole">
            <MoleAvatar config={avatarConfig} size={140} />
          </div>
          <div className="reveal-hole-mouth" />
        </div>
        <h2 className="reveal-title">Meet your mole buddy!</h2>
        <p className="reveal-sub">
          {classification?.label === 'yes'
            ? `${name || 'This mole'} has some features worth asking a doctor about.`
            : `${name || 'Your mole'} is ready for a closer look.`}
        </p>
      </div>

      {/* RESULTS GRID */}
      <div className="results-grid results-grid-3">
        {/* Column 1: Crop + measurements + classification */}
        <div className="results-col">
          {cropImageDataUrl && (
            <div className="results-crop-card reveal-in">
              <div className="results-crop-label">Your mole, up close</div>
              <img src={cropImageDataUrl} alt="Cropped mole" className="results-crop-img" />
            </div>
          )}

          {measurements && (
            <div className="results-panel reveal-in reveal-delay-1">
              <h4>📏 Measurements</h4>
              <div className="result-row"><span className="rlabel">Diameter</span><span className={`rvalue ${diamClass(measurements.mole_diameter_mm)}`}>{measurements.mole_diameter_mm} mm</span></div>
              <div className="result-row"><span className="rlabel">Area</span><span className="rvalue">{measurements.mole_area_sq_mm} mm&sup2;</span></div>
              <div className="result-row"><span className="rlabel">Painted pixels</span><span className="rvalue">{measurements.mole_pixel_count.toLocaleString()}</span></div>
              <div className="result-row"><span className="rlabel">Penny reference</span><span className="rvalue">{measurements.penny_pixel_area.toLocaleString()} px</span></div>
            </div>
          )}

          {classification && (
            <div className={`classification-result reveal-in reveal-delay-2 ${classification.label === 'yes' ? 'cls-positive' : 'cls-negative'}`}>
              <div className="cls-source">🔬 AI Comparison with 2,000 Real Examples of Cancer and False Positives</div>
              <div className="cls-header">
                <MoleAvatar config={avatarConfig} size={40} />
                <span className="cls-icon">{classification.label === 'yes' ? '⚠' : '✓'}</span>
                <span className="cls-verdict">{classification.label === 'yes' ? 'Suspicious' : 'Likely Benign'}</span>
              </div>
              <div className="cls-confidence">Confidence: <strong>{classification.confidence}%</strong></div>
              <div className="cls-disclaimer">Not a medical diagnosis.</div>
            </div>
          )}
        </div>

        {/* Column 2: ABCDE + growth */}
        <div className="results-col">
          {analysis && (
            <div className="abc-panel reveal-in reveal-delay-1">
              <h4>🔬 ABCDE Analysis</h4>
              <p className="abc-intro">The classic warning signs. Heuristic &mdash; not medical.</p>
              <AbcRow letter="A" title="Asymmetry" value={`${analysis.asymmetry}%`} level={analysis.asymmetryLevel}
                hint={analysis.asymmetryLevel === 'low' ? 'Halves look similar.' : analysis.asymmetryLevel === 'moderate' ? 'One half differs somewhat.' : 'The two halves look very different.'} />
              <AbcRow letter="B" title="Border" value={analysis.borderLevel} level={abcLevelToDanger(analysis.borderLevel, { smooth: 'low', irregular: 'moderate', jagged: 'high' })}
                hint={analysis.borderLevel === 'smooth' ? 'Edges are clean and rounded.' : analysis.borderLevel === 'irregular' ? 'Edges are somewhat uneven.' : 'Edges are jagged or notched.'} />
              <AbcRow letter="C" title="Color" value={analysis.colorLevel} level={abcLevelToDanger(analysis.colorLevel, { uniform: 'low', mixed: 'moderate', variable: 'high' })}
                hint={analysis.colorLevel === 'uniform' ? 'One consistent color.' : analysis.colorLevel === 'mixed' ? 'A couple of tones mixed in.' : 'Multiple colors within the mole.'} />
              <AbcRow letter="D" title="Diameter" value={`${measurements.mole_diameter_mm} mm`} level={measurements.mole_diameter_mm >= 6 ? 'high' : measurements.mole_diameter_mm >= 4 ? 'moderate' : 'low'}
                hint={measurements.mole_diameter_mm >= 6 ? 'Larger than 6 mm — worth asking a doctor about.' : 'Under the 6 mm "pencil eraser" threshold.'} />
              {selectedMole && (
                <AbcRow letter="E" title="Evolving"
                  value={(() => { const g = growthInfo?.pctChange; if (g == null) return '—'; return `${g > 0 ? '+' : ''}${g}%` })()}
                  level={growthInfo?.pctChange >= 20 ? 'high' : (growthInfo?.pctChange ?? 0) > 0 ? 'moderate' : 'low'}
                  hint={growthInfo?.pctChange >= 20 ? 'Grew more than 20% — please see a doctor.' : growthInfo?.pctChange > 0 ? 'Slight growth since last time.' : 'No growth or smaller — good sign.'} />
              )}
              <div className="abc-disclaimer">Heuristic estimates &mdash; <strong>not a medical diagnosis</strong>.</div>
            </div>
          )}

          {growthInfo && (
            <div className={`growth-alert reveal-in reveal-delay-2 ${growthInfo.pctChange >= 20 ? 'growth-danger' : growthInfo.pctChange > 0 ? 'growth-warn' : 'growth-ok'}`}>
              <div className="growth-header">{growthInfo.pctChange >= 20 ? '⚠ Significant Growth Detected' : growthInfo.pctChange > 0 ? 'Slight Growth' : 'No Growth / Smaller'}</div>
              <div className="growth-detail">{growthInfo.oldArea} mm&sup2; &rarr; {growthInfo.newArea} mm&sup2; ({growthInfo.pctChange > 0 ? '+' : ''}{growthInfo.pctChange}%)</div>
              {growthInfo.pctChange >= 20 && <div className="growth-warning">Grown more than 20% since last measurement. Consult a dermatologist.</div>}
            </div>
          )}
        </div>

        {/* Column 3: Naming form */}
        <div className="results-col">
          <div className="results-form reveal-in">
            <h4>🏷 Name your mole</h4>
            <div className="name-section">
              <div className="name-row">
                <button type="button" className="name-avatar-preview" onClick={() => setShowBuilder(s => !s)} title="Customize my mole">
                  <MoleAvatar config={avatarConfig} size={56} />
                </button>
                <div className="name-input-area">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Mole Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Give it a fun name!" />
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-outline btn-customize" onClick={() => setShowBuilder(s => !s)}>
                {showBuilder ? '✕ Close customizer' : '🎨 Customize My Mole'}
              </button>
              {showBuilder && (
                <AvatarBuilder config={avatarConfig} onChange={setAvatarConfig} onClose={() => setShowBuilder(false)} />
              )}
            </div>
            <div className="field"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="field"><label>Observations</label><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Noticed anything about this mole?" /></div>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="results-actions reveal-in reveal-delay-3">
        <button className="btn btn-outline" onClick={onRedo}>↩ Redo labeling</button>
        <ShareButton measurements={measurements} classification={classification} name={saveLabel} />
        <button className="btn btn-success" onClick={onSave} disabled={isSaved}>
          {isSaved ? '✓ Saved' : '💾 Save Record'}
        </button>
      </div>
      {isSaved && (
        <div className="status-bar success" style={{ maxWidth: 500, margin: '12px auto 0' }}>{status.msg}</div>
      )}
      <div className="results-footer-actions">
        <button className="link-btn" onClick={onStartOver}>Start a completely new analysis →</button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════
function abcLevelToDanger(value, map) { return map[value] || 'low' }

function AbcRow({ letter, title, value, level, hint }) {
  const cls = level === 'high' ? 'abc-high' : level === 'moderate' ? 'abc-moderate' : 'abc-low'
  return (
    <div className={`abc-row ${cls}`}>
      <div className="abc-letter-badge">{letter}</div>
      <div className="abc-row-body">
        <div className="abc-row-head">
          <span className="abc-title">{title}</span>
          <span className="abc-value">{value}</span>
        </div>
        <div className="abc-hint">{hint}</div>
      </div>
    </div>
  )
}

function parseClassification(result) {
  // Parse classification response from Roboflow workflow (called from browser)
  let items = result
  if (result && !Array.isArray(result) && result.outputs) items = result.outputs
  if (!items) return { label: 'unknown', confidence: 0 }
  if (!Array.isArray(items)) items = [items]

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    for (const [key, val] of Object.entries(item)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        if (val.class) return { label: val.class, confidence: Math.round((val.confidence || 0) * 1000) / 10 }
        if (val.predictions) {
          const preds = val.predictions
          if (typeof preds === 'object' && !Array.isArray(preds)) {
            const top = val.top || ''
            const topConf = preds[top]?.confidence || 0
            return { label: top, confidence: Math.round(topConf * 1000) / 10 }
          }
          if (Array.isArray(preds) && preds.length > 0) {
            return { label: preds[0].class || 'unknown', confidence: Math.round((preds[0].confidence || 0) * 1000) / 10 }
          }
        }
      }
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0].class) {
        return { label: val[0].class, confidence: Math.round((val[0].confidence || 0) * 1000) / 10 }
      }
    }
  }
  return { label: 'unknown', confidence: 0 }
}

function extractPennyArea(result) {
  // Handle various response formats: direct array, {outputs: [...]}, or single object
  let items = result
  if (result && !Array.isArray(result) && result.outputs) items = result.outputs
  if (!items) return null
  if (!Array.isArray(items)) items = [items]

  console.log('extractPennyArea items:', JSON.stringify(items, null, 2))

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const areaValues = item.area_values
    if (!Array.isArray(areaValues) || areaValues.length === 0) continue

    // Get predictions array — area_values[i] corresponds to predictions[i]
    let predictions = null
    for (const key of Object.keys(item)) {
      const val = item[key]
      if (val && typeof val === 'object' && !Array.isArray(val) && val.predictions) {
        predictions = val.predictions
        break
      }
    }

    console.log('area_values:', areaValues)
    console.log('predictions count:', predictions ? predictions.length : 0)

    if (predictions && Array.isArray(predictions) && predictions.length > 0) {
      // Pick the penny with the HIGHEST confidence — that's the real penny
      let bestIdx = 0
      let bestConf = predictions[0].confidence || 0
      for (let i = 1; i < predictions.length; i++) {
        const conf = predictions[i].confidence || 0
        if (conf > bestConf) { bestConf = conf; bestIdx = i }
      }
      // Use the area that corresponds to the best prediction
      const area = areaValues[bestIdx] !== undefined ? areaValues[bestIdx] : areaValues[0]
      const p = predictions[bestIdx]
      const bbox = { x: p.x, y: p.y, width: p.width, height: p.height, confidence: p.confidence || 0.9 }

      console.log(`Picked prediction[${bestIdx}] with confidence ${bestConf}, area=${area}`)
      return { area, bbox }
    }

    // No predictions — just pick the first area value (single detection)
    return { area: areaValues[0], bbox: null }
  }
  return null
}

// ═════════════════════════════════════════════════════════════
// ICONS
// ═════════════════════════════════════════════════════════════
function CameraIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> }
function BrushIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg> }
function EraserIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16l9-9 8 8-4 4z"/><path d="M6.5 13.5l5-5"/></svg> }
function TrashIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function ShareIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> }
