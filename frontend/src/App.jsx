import { useState, useRef, useEffect, createContext, useContext, useMemo } from 'react'
import './App.css'

const API = ''
const PaintContext = createContext()

// Roboflow config — calls made directly from browser to avoid Cloudflare blocking serverless IPs
const RF_API_KEY = 'jIlsPhHeCYPv0LCOooQT'
const RF_WORKSPACE = 'michael-h89ju'
const RF_PENNY_WORKFLOW = 'penny-area-measurement-pipeline-1776292482637'
const RF_CLASSIFY_WORKFLOW = 'custom-workflow-11'

async function callRoboflowWorkflow(workflowId, imageBase64) {
  const url = `https://serverless.roboflow.com/${RF_WORKSPACE}/workflows/${workflowId}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: RF_API_KEY,
      inputs: { image: { type: 'base64', value: imageBase64 } }
    })
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Roboflow error ${resp.status}: ${text}`)
  }
  const data = await resp.json()
  return data.outputs || data
}

const FUN_NAMES = [
  'Spotty McSpotface', 'Sir Dots-a-Lot', 'Princess Freckle', 'Captain Speckle',
  'Dotty McDotface', 'Mole-y Cyrus', 'Spot Light', 'Freckle Freddy',
  'Penny Lane', 'Dot Com', 'Spot Check', 'Lady Speckle',
  'The Dot Father', 'Spot-ify', 'Dottie Parton', 'Mole-ana',
  'Speck-tacular', 'Freckle Fern', 'Polka Dot', 'Cinnamon Spot',
  'Cocoa Puff', 'Mocha Mark', 'Starry Spot', 'Pixel Pete',
  'Button', 'Brownie Bite', 'Sunny Speck', 'Luna Dot',
]

// ═════════════════════════════════════════════════════════════
// CUTE MOLE AVATAR — procedural SVG creature from name
// ═════════════════════════════════════════════════════════════
function MoleAvatar({ name, size = 48 }) {
  const avatar = useMemo(() => {
    const n = (name || 'Mole').trim()
    let h = 0
    for (let i = 0; i < n.length; i++) h = ((h << 5) - h + n.charCodeAt(i)) | 0
    const a = Math.abs(h)

    const palettes = [
      ['#FF6B6B','#FF8E8E'], ['#4ECDC4','#7EDDD6'], ['#45B7D1','#74CBE0'],
      ['#96CEB4','#B5DFCC'], ['#FFEAA7','#FFF2CC'], ['#DDA0DD','#EBC4EB'],
      ['#98D8C8','#B8E8DC'], ['#F7DC6F','#FAE99D'], ['#BB8FCE','#D4B5E0'],
      ['#85C1E9','#AAD4F0'], ['#F1948A','#F6B5AE'], ['#82E0AA','#A8ECC5'],
      ['#F0B27A','#F5CCA4'], ['#AED6F1','#CEEAF8'], ['#D7BDE2','#E8D5F0'],
    ]
    const [bodyColor, bodyLight] = palettes[a % palettes.length]
    const eyeStyle = a % 5    // round, happy, wink, star, heart
    const mouthStyle = a % 4  // smile, grin, tongue, o
    const accessory = a % 8   // none, hat, bow, crown, glasses, flower, bandana, none
    const hasBlush = a % 3 !== 2
    const hasFeet = a % 2 === 0
    const earStyle = a % 3     // round, pointy, none
    const bodyShape = a % 3    // circle, blob, square-ish

    return { bodyColor, bodyLight, eyeStyle, mouthStyle, accessory, hasBlush, hasFeet, earStyle, bodyShape }
  }, [name])

  const { bodyColor, bodyLight, eyeStyle, mouthStyle, accessory, hasBlush, hasFeet, earStyle, bodyShape } = avatar

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      {/* Ears */}
      {earStyle === 0 && <>
        <circle cx="22" cy="28" r="12" fill={bodyColor} />
        <circle cx="78" cy="28" r="12" fill={bodyColor} />
        <circle cx="22" cy="28" r="7" fill={bodyLight} />
        <circle cx="78" cy="28" r="7" fill={bodyLight} />
      </>}
      {earStyle === 1 && <>
        <polygon points="20,15 30,35 10,35" fill={bodyColor} />
        <polygon points="80,15 90,35 70,35" fill={bodyColor} />
      </>}

      {/* Body */}
      {bodyShape === 0 && <circle cx="50" cy="55" r="32" fill={bodyColor} />}
      {bodyShape === 1 && <ellipse cx="50" cy="55" rx="34" ry="30" fill={bodyColor} />}
      {bodyShape === 2 && <rect x="20" y="27" width="60" height="56" rx="18" fill={bodyColor} />}

      {/* Belly */}
      <ellipse cx="50" cy="60" rx="18" ry="16" fill={bodyLight} opacity="0.5" />

      {/* Feet */}
      {hasFeet && <>
        <ellipse cx="36" cy="86" rx="10" ry="6" fill={bodyColor} />
        <ellipse cx="64" cy="86" rx="10" ry="6" fill={bodyColor} />
      </>}

      {/* Arms */}
      <ellipse cx="19" cy="58" rx="7" ry="5" fill={bodyColor} transform="rotate(-20 19 58)" />
      <ellipse cx="81" cy="58" rx="7" ry="5" fill={bodyColor} transform="rotate(20 81 58)" />

      {/* Eyes */}
      {eyeStyle === 0 && <>
        <circle cx="39" cy="48" r="6" fill="white" /><circle cx="39" cy="48" r="3.5" fill="#333" /><circle cx="40.5" cy="46.5" r="1.2" fill="white" />
        <circle cx="61" cy="48" r="6" fill="white" /><circle cx="61" cy="48" r="3.5" fill="#333" /><circle cx="62.5" cy="46.5" r="1.2" fill="white" />
      </>}
      {eyeStyle === 1 && <>
        <path d="M33 48 Q39 42 45 48" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M55 48 Q61 42 67 48" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
      </>}
      {eyeStyle === 2 && <>
        <circle cx="39" cy="48" r="6" fill="white" /><circle cx="39" cy="48" r="3.5" fill="#333" /><circle cx="40.5" cy="46.5" r="1.2" fill="white" />
        <path d="M55 48 Q61 42 67 48" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
      </>}
      {eyeStyle === 3 && <>
        <text x="39" y="52" textAnchor="middle" fontSize="14" fill="#333">★</text>
        <text x="61" y="52" textAnchor="middle" fontSize="14" fill="#333">★</text>
      </>}
      {eyeStyle === 4 && <>
        <text x="39" y="52" textAnchor="middle" fontSize="13" fill="#e91e63">♥</text>
        <text x="61" y="52" textAnchor="middle" fontSize="13" fill="#e91e63">♥</text>
      </>}

      {/* Blush */}
      {hasBlush && <>
        <circle cx="30" cy="58" r="5" fill="#FFB6C1" opacity="0.5" />
        <circle cx="70" cy="58" r="5" fill="#FFB6C1" opacity="0.5" />
      </>}

      {/* Mouth */}
      {mouthStyle === 0 && <path d="M42 63 Q50 72 58 63" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />}
      {mouthStyle === 1 && <path d="M40 63 Q50 74 60 63" fill="#333" />}
      {mouthStyle === 2 && <>
        <path d="M42 63 Q50 72 58 63" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="50" cy="70" rx="4" ry="3" fill="#FF6B6B" />
      </>}
      {mouthStyle === 3 && <circle cx="50" cy="65" r="4" fill="#333" />}

      {/* Accessories */}
      {accessory === 1 && <>
        <ellipse cx="50" cy="22" rx="20" ry="6" fill="#333" />
        <rect x="38" y="8" width="24" height="16" rx="4" fill="#333" />
        <rect x="42" y="18" width="16" height="4" rx="2" fill="#f9a825" />
      </>}
      {accessory === 2 && <>
        <circle cx="35" cy="28" r="5" fill="#FF69B4" />
        <circle cx="28" cy="25" r="4" fill="#FF69B4" />
        <circle cx="32" cy="22" r="4" fill="#FF69B4" />
      </>}
      {accessory === 3 && <>
        <polygon points="50,8 42,24 58,24" fill="#FFD700" />
        <polygon points="42,8 34,22 50,22" fill="#FFD700" />
        <polygon points="58,8 50,22 66,22" fill="#FFD700" />
        <circle cx="42" cy="20" r="2" fill="#FF6B6B" />
        <circle cx="50" cy="16" r="2" fill="#4FC3F7" />
        <circle cx="58" cy="20" r="2" fill="#66BB6A" />
      </>}
      {accessory === 4 && <>
        <circle cx="39" cy="48" r="9" fill="none" stroke="#333" strokeWidth="2" />
        <circle cx="61" cy="48" r="9" fill="none" stroke="#333" strokeWidth="2" />
        <line x1="48" y1="48" x2="52" y2="48" stroke="#333" strokeWidth="2" />
      </>}
      {accessory === 5 && <>
        <circle cx="72" cy="30" r="6" fill="#FF69B4" />
        <circle cx="72" cy="30" r="3" fill="#FFD700" />
        <ellipse cx="68" cy="36" rx="3" ry="5" fill="#66BB6A" />
      </>}
      {accessory === 6 && <>
        <path d="M25 32 Q50 20 75 32" fill={bodyColor} stroke="#f9a825" strokeWidth="2" strokeDasharray="3 2" />
      </>}
    </svg>
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
      `🪙 Penny for Cancer — Mole Report`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Mole: ${name || 'Unnamed'}`,
      ms.mole_diameter_mm ? `Diameter: ${ms.mole_diameter_mm} mm` : '',
      ms.mole_area_sq_mm ? `Area: ${ms.mole_area_sq_mm} mm²` : '',
      classification ? `AI Screening: ${classification.label === 'yes' ? '⚠️ Suspicious' : '✅ Likely Benign'} (${classification.confidence}% confidence)` : '',
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
        await navigator.share({ title: 'Penny for Cancer — Mole Report', text: msg })
      } catch {}
    } else if (method === 'email') {
      const subject = encodeURIComponent('Penny for Cancer — Mole Report')
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
  const maskCanvasRef = useRef(null)
  const imgCanvasRef = useRef(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    try { const r = await fetch(`${API}/api/moles`); setMoles(await r.json()) } catch {}
  }

  function goHome() {
    setPage('home'); setImage(null); setMeasurements(null)
    setPennyData(null); setClassification(null); setCropImageDataUrl(null); setSelectedMole(null)
    setStatus({ type: '', msg: '' })
  }

  function startNew() { setSelectedMole(null); setPage('new') }

  function startExisting() { setPage('existing') }

  function selectMoleAndAnalyze(m) {
    setSelectedMole(m); setImage(null); setMeasurements(null)
    setPennyData(null); setClassification(null); setCropImageDataUrl(null)
    setStatus({ type: '', msg: '' }); setPage('new')
  }

  // Resize image to fit within maxDim and return base64 JPEG (keeps payload under Vercel's 4.5MB limit)
  function compressImage(file, maxDim = 1600) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h)
          w = Math.round(w * scale); h = Math.round(h * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const b64 = dataUrl.split(',')[1]
        resolve({ b64, width: img.width, height: img.height, url })
      }
      img.src = url
    })
  }

  async function handleUpload(file) {
    setStatus({ type: 'loading', msg: 'Uploading...' })
    setMeasurements(null); setPennyData(null); setClassification(null); setCropImageDataUrl(null)
    try {
      // Compress image for API calls (keeps under Vercel body size limit)
      const { b64, width, height, url } = await compressImage(file)
      setImage({ filename: file.name, width, height, url, base64: b64 })
      setStatus({ type: 'success', msg: 'Image loaded. Paint over the mole, then click Detect.' })
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
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
    setMeasurements(null); setClassification(null); setCropImageDataUrl(null)
    try {
      // Step 1: Detect penny — call Roboflow directly from browser (avoids Cloudflare blocking serverless IPs)
      const pennyResult = await callRoboflowWorkflow(RF_PENNY_WORKFLOW, image.base64)
      console.log('=== PENNY DETECT RESPONSE ===', JSON.stringify(pennyResult, null, 2))
      const pennyArea = extractPennyArea(pennyResult)
      if (!pennyArea) throw new Error('No penny detected. Raw response: ' + JSON.stringify(pennyResult).slice(0, 300))
      setPennyData(pennyArea)

      // Step 2: Calculate measurements (simple math — can do client-side too, but keep backend for consistency)
      const PENNY_AREA_SQ_IN = 0.448
      const sqInPerPx = PENNY_AREA_SQ_IN / pennyArea.area
      const moleAreaIn = count * sqInPerPx
      const moleAreaMm = moleAreaIn * 645.16
      const moleDiamIn = 2 * Math.sqrt(moleAreaIn / Math.PI)
      const moleDiamMm = moleDiamIn * 25.4
      const calcResult = {
        penny_pixel_area: Math.round(pennyArea.area * 10) / 10,
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
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
  }

  async function handleSave(name, date, notes) {
    try {
      await fetch(`${API}/api/moles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, date, notes,
          image_filename: image.filename,
          mask_pixel_count: maskPixelCount,
          measurements,
          classification: classification ? {
            label: classification.label,
            confidence: classification.confidence,
          } : null,
          crop_image: cropImageDataUrl || null,
        }),
      })
      setStatus({ type: 'success', msg: `Saved "${name}"! 🎉` }); loadHistory()
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
  }

  async function handleDelete(id) {
    await fetch(`${API}/api/moles?id=${id}`, { method: 'DELETE' }); loadHistory()
  }

  function countMaskPixels() {
    const c = maskCanvasRef.current; if (!c) return 0
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++
    return n
  }

  return (
    <div className="app">
      <header className="app-header" onClick={goHome} style={{ cursor: 'pointer' }}>
        <img src="/penny.png" alt="Penny" className="header-penny" />
        <h1>Penny <span>for Cancer</span></h1>
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

        {page === 'new' && (
          <div className="app-layout">
            <aside className="sidebar">
              <div className="sidebar-section">
                <button className="btn btn-outline" onClick={goHome}>&larr; Back to Home</button>
              </div>
              <UploadSection onUpload={handleUpload} />
              {image && (
                <>
                  <PaintToolbar />
                  <MoleForm
                    onDetect={handleDetect} onSave={handleSave}
                    status={status} measurements={measurements} classification={classification}
                    cropImageDataUrl={cropImageDataUrl}
                    selectedMole={selectedMole} onClearSelection={() => setSelectedMole(null)}
                  />
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
                <CanvasEditor image={image} maskCanvasRef={maskCanvasRef} imgCanvasRef={imgCanvasRef} pennyData={pennyData} />
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
        <h2>Welcome to Penny for Cancer</h2>
        <p className="hero-subtitle">
          A free tool to help you measure and monitor moles on your skin using nothing more than a photo and a US penny.
          Early detection saves lives &mdash; track your moles, spot changes, and know when to see a dermatologist.
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
          <p className="muted">No measurements yet. Start by analyzing a new mole above.</p>
        ) : (
          <div className="recent-table">
            <div className="recent-header">
              <span></span><span>Name</span><span>Date</span><span>Diameter</span><span>AI Screen</span><span></span>
            </div>
            {recent.map(m => {
              const ms = m.measurements || {}
              const cls = m.classification
              return (
                <div key={m.id} className="recent-row">
                  <span className="recent-avatar">
                    {m.crop_image
                      ? <img src={m.crop_image} alt="" className="recent-thumb" />
                      : <MoleAvatar name={m.name || 'Mole'} size={36} />
                    }
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
            <p>The mole is larger than 6mm (about the size of a pencil eraser). <strong>This is exactly what Penny for Cancer measures.</strong></p>
          </div>
          <div className="abcde-card">
            <div className="abcde-letter">E</div>
            <h4>Evolving</h4>
            <p>The mole is changing in size, shape, or color over time. <strong>Track this with our re-measurement tool.</strong></p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="home-section mission-section">
        <h3>Our Mission</h3>
        <div className="mission-content">
          <p>
            <strong>Skin cancer is the most common cancer in the United States.</strong> One in five Americans will develop skin cancer by age 70, and melanoma &mdash; the most dangerous form &mdash; kills over 7,000 Americans each year.
          </p>
          <p>
            Yet early detection changes everything. When caught early, the 5-year survival rate for melanoma is <strong>99%</strong>. The problem is most people don't monitor their moles regularly, and when they do, they have no objective way to measure changes.
          </p>
          <p>
            <strong>Penny for Cancer</strong> solves this with something everyone has: a penny. By placing a penny next to a mole and taking a photo, our AI-powered tool can calculate the exact size of the mole in millimeters, compare it against 2,000+ dermoscopic samples from the Stanford MIDAS database, and track changes over time &mdash; flagging any mole that grows more than 20%.
          </p>
          <p>
            This is not a replacement for professional medical advice. It's a tool to help you be proactive about your skin health and know when it's time to see a dermatologist.
          </p>
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
                  <MoleAvatar name={name} size={52} />
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
function CanvasEditor({ image, maskCanvasRef, imgCanvasRef, pennyData }) {
  const containerRef = useRef()
  const painting = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const imgObjRef = useRef(null)
  const { paintSettings: ps } = useContext(PaintContext)
  const psRef = useRef(ps)
  useEffect(() => { psRef.current = ps }, [ps])

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => {
      imgObjRef.current = img
      imgCanvasRef.current.width = img.width; imgCanvasRef.current.height = img.height
      maskCanvasRef.current.width = img.width; maskCanvasRef.current.height = img.height
      imgCanvasRef.current.getContext('2d').drawImage(img, 0, 0); fitCanvas()
    }
    img.src = image.url
  }, [image])

  useEffect(() => {
    if (!pennyData || !imgObjRef.current) return
    const ctx = imgCanvasRef.current.getContext('2d')
    ctx.drawImage(imgObjRef.current, 0, 0)
    const bbox = pennyData.bbox
    if (bbox) {
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 3
      const x = bbox.x - bbox.width / 2, y = bbox.y - bbox.height / 2
      ctx.strokeRect(x, y, bbox.width, bbox.height)
      ctx.fillStyle = '#00ff88'; ctx.font = 'bold 16px sans-serif'
      ctx.fillText(`Penny (${pennyData.area.toLocaleString()}px)`, x, y - 6)
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
    const s = Math.min((r.width - 40) / imgObjRef.current.width, (r.height - 40) / imgObjRef.current.height, 1)
    const w = Math.round(imgObjRef.current.width * s) + 'px', h = Math.round(imgObjRef.current.height * s) + 'px'
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

  return (
    <>
      <div className="canvas-container" ref={containerRef}>
        <canvas ref={imgCanvasRef} className="layer-canvas" />
        <canvas ref={maskCanvasRef} className="layer-canvas mask-canvas"
          style={{ opacity: ps.opacity / 100, cursor: ps.tool === 'eraser' ? 'cell' : 'crosshair' }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} />
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
// MOLE FORM — fun naming + auto classification results
// ═════════════════════════════════════════════════════════════
function MoleForm({ onDetect, onSave, status, measurements, classification, cropImageDataUrl, selectedMole, onClearSelection }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [showNamePicker, setShowNamePicker] = useState(false)

  useEffect(() => { if (selectedMole) setName(selectedMole.name) }, [selectedMole])

  function randomName() {
    const n = FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)]
    setName(n)
  }

  function diamClass(mm) { return mm >= 6 ? 'danger' : mm >= 4 ? 'warn' : 'safe' }

  const growthInfo = selectedMole && measurements && selectedMole.measurements ? (() => {
    const oldArea = selectedMole.measurements.mole_area_sq_mm, newArea = measurements.mole_area_sq_mm
    if (!oldArea || oldArea === 0) return null
    return { oldArea, newArea, pctChange: Math.round(((newArea - oldArea) / oldArea) * 1000) / 10 }
  })() : null

  return (
    <div className="sidebar-section">
      <h3>{selectedMole ? 'Re-measure Existing Mole' : 'Name Your Mole Buddy'}</h3>
      {selectedMole && (
        <div className="remeasure-banner">
          <div className="remeasure-info">Re-measuring: <strong>{selectedMole.name}</strong>
            <br/><span className="remeasure-prev">Previous: {selectedMole.measurements?.mole_area_sq_mm} mm&sup2; on {selectedMole.date}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClearSelection}>New mole instead</button>
        </div>
      )}

      {/* Fun name section with live avatar preview */}
      <div className="name-section">
        <div className="name-row">
          <div className="name-avatar-preview">
            <MoleAvatar name={name || 'Mole'} size={56} />
          </div>
          <div className="name-input-area">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Mole Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Give it a fun name!" />
            </div>
          </div>
        </div>
        <div className="name-buttons">
          <button className="btn-mini btn-dice" onClick={randomName} title="Random fun name">🎲 Random Name</button>
          <button className="btn-mini btn-list" onClick={() => setShowNamePicker(!showNamePicker)} title="Pick from list">
            {showNamePicker ? '✕ Close' : '📋 Name Ideas'}
          </button>
        </div>
        {showNamePicker && (
          <div className="name-picker">
            {FUN_NAMES.map(n => (
              <button key={n} className={`name-chip ${name === n ? 'active' : ''}`} onClick={() => { setName(n); setShowNamePicker(false) }}>
                <MoleAvatar name={n} size={24} /> {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="field"><label>Notes</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations..." /></div>
      <button className="btn btn-primary" onClick={onDetect}><SearchIcon /> Detect Penny, Measure &amp; Screen</button>

      {status.msg && <div className={`status-bar ${status.type}`}>{status.type === 'loading' && <span className="spinner" />}{status.msg}</div>}

      {measurements && (
        <>
          <div className="results-panel">
            <h4>📏 Measurements</h4>
            <div className="result-row"><span className="rlabel">Penny area (px)</span><span className="rvalue">{measurements.penny_pixel_area.toLocaleString()}</span></div>
            <div className="result-row"><span className="rlabel">Mole area (px)</span><span className="rvalue">{measurements.mole_pixel_count.toLocaleString()}</span></div>
            <div className="result-row"><span className="rlabel">Mole area</span><span className="rvalue">{measurements.mole_area_sq_mm} mm&sup2; ({measurements.mole_area_sq_inches} in&sup2;)</span></div>
            <div className="result-row"><span className="rlabel">Mole diameter</span><span className={`rvalue ${diamClass(measurements.mole_diameter_mm)}`}>{measurements.mole_diameter_mm} mm ({measurements.mole_diameter_inches} in)</span></div>
          </div>

          {/* Classification result — auto-run, shown inline */}
          {classification && (
            <div className={`classification-result ${classification.label === 'yes' ? 'cls-positive' : 'cls-negative'}`}>
              <div className="cls-source">🔬 AI Screening — 2,000+ dermoscopic samples from the Stanford MIDAS database</div>
              <div className="cls-header">
                <span className="cls-icon">{classification.label === 'yes' ? '⚠' : '✓'}</span>
                <span className="cls-verdict">{classification.label === 'yes' ? 'Suspicious' : 'Likely Benign'}</span>
              </div>
              <div className="cls-confidence">Confidence: <strong>{classification.confidence}%</strong></div>
              {cropImageDataUrl && (
                <div className="cls-crop-preview">
                  <img src={cropImageDataUrl} alt="Cropped mole" />
                  <span className="cls-crop-label">Analyzed region</span>
                </div>
              )}
              <div className="cls-label">{classification.label === 'yes' ? 'This mole shares features with potentially malignant samples. Please consult a dermatologist.' : 'This mole appears similar to benign samples. Continue monitoring for changes.'}</div>
              <div className="cls-disclaimer">This is not a medical diagnosis. Always consult a qualified dermatologist for clinical evaluation.</div>
            </div>
          )}

          {growthInfo && (
            <div className={`growth-alert ${growthInfo.pctChange >= 20 ? 'growth-danger' : growthInfo.pctChange > 0 ? 'growth-warn' : 'growth-ok'}`}>
              <div className="growth-header">{growthInfo.pctChange >= 20 ? '⚠ Significant Growth Detected' : growthInfo.pctChange > 0 ? 'Slight Growth' : 'No Growth / Smaller'}</div>
              <div className="growth-detail">{growthInfo.oldArea} mm&sup2; &rarr; {growthInfo.newArea} mm&sup2; ({growthInfo.pctChange > 0 ? '+' : ''}{growthInfo.pctChange}%)</div>
              {growthInfo.pctChange >= 20 && <div className="growth-warning">This mole has grown more than 20% since last measurement. Please consult a dermatologist.</div>}
            </div>
          )}

          {/* Share + Save buttons */}
          <div className="action-row">
            <ShareButton measurements={measurements} classification={classification} name={name || 'Unnamed'} />
            <button className="btn btn-success" onClick={() => onSave(name || 'Unnamed', date, notes)}>💾 Save Record</button>
          </div>
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════
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
