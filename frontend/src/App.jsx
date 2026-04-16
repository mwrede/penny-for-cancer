import { useState, useRef, useEffect, createContext, useContext } from 'react'
import './App.css'

const API = ''
const PaintContext = createContext()

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
  const [selectedMole, setSelectedMole] = useState(null)
  const maskCanvasRef = useRef(null)
  const imgCanvasRef = useRef(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    try { const r = await fetch(`${API}/api/moles`); setMoles(await r.json()) } catch {}
  }

  function goHome() {
    setPage('home'); setImage(null); setMeasurements(null)
    setPennyData(null); setClassification(null); setSelectedMole(null)
    setStatus({ type: '', msg: '' })
  }

  function startNew() { setSelectedMole(null); setPage('new') }

  function startExisting() { setPage('existing') }

  function selectMoleAndAnalyze(m) {
    setSelectedMole(m); setImage(null); setMeasurements(null)
    setPennyData(null); setClassification(null)
    setStatus({ type: '', msg: '' }); setPage('new')
  }

  async function handleUpload(file) {
    setStatus({ type: 'loading', msg: 'Uploading...' })
    setMeasurements(null); setPennyData(null); setClassification(null)
    const fd = new FormData(); fd.append('image', file)
    try {
      const r = await fetch(`${API}/api/upload`, { method: 'POST', body: fd })
      const d = await r.json(); if (d.error) throw new Error(d.error)
      setImage({ filename: d.filename, width: d.width, height: d.height, url: `${API}/uploads/${d.filename}` })
      setStatus({ type: 'success', msg: 'Image loaded. Paint over the mole, then click Detect.' })
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
  }

  async function handleDetect() {
    const count = countMaskPixels()
    if (count < 50) { setStatus({ type: 'error', msg: 'Paint over the mole first.' }); return }
    setMaskPixelCount(count)
    setStatus({ type: 'loading', msg: 'Running Roboflow penny detection...' }); setMeasurements(null)
    try {
      const r1 = await fetch(`${API}/api/detect-penny`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_path: image.filename }),
      })
      const d1 = await r1.json(); if (d1.error) throw new Error(d1.error)
      const pennyArea = extractPennyArea(d1.result)
      if (!pennyArea) throw new Error('No penny detected. Make sure a penny is visible in the photo.')
      setPennyData(pennyArea)
      const r2 = await fetch(`${API}/api/calculate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mask_pixel_count: count, penny_pixel_area: pennyArea.area }),
      })
      const d2 = await r2.json(); if (d2.error) throw new Error(d2.error)
      setMeasurements(d2); setStatus({ type: 'success', msg: 'Measurement complete!' })
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
  }

  async function handleSave(name, date, notes) {
    try {
      await fetch(`${API}/api/moles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, date, notes, image_filename: image.filename, mask_pixel_count: maskPixelCount, measurements }),
      })
      setStatus({ type: 'success', msg: `Saved "${name}".` }); loadHistory()
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
  }

  async function handleDelete(id) {
    await fetch(`${API}/api/moles/${id}`, { method: 'DELETE' }); loadHistory()
  }

  async function handleClassify() {
    const mc = maskCanvasRef.current, ic = imgCanvasRef.current
    if (!mc || !ic) { setStatus({ type: 'error', msg: 'No image loaded.' }); return }
    const maskData = mc.getContext('2d').getImageData(0, 0, mc.width, mc.height).data
    let minX = mc.width, minY = mc.height, maxX = 0, maxY = 0
    for (let y = 0; y < mc.height; y++)
      for (let x = 0; x < mc.width; x++)
        if (maskData[(y * mc.width + x) * 4 + 3] > 0) {
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
    if (maxX <= minX || maxY <= minY) { setStatus({ type: 'error', msg: 'Paint over the mole first.' }); return }
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
    const b64 = cropCanvas.toDataURL('image/jpeg', 0.9).split(',')[1]
    setStatus({ type: 'loading', msg: 'Running comparison against Stanford MIDAS database (2,000 samples)...' })
    setClassification(null)
    try {
      const r = await fetch(`${API}/api/classify-mole`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: b64 }),
      })
      const d = await r.json(); if (d.error) throw new Error(d.error)
      setClassification(d); setStatus({ type: 'success', msg: 'Comparison complete.' })
    } catch (e) { setStatus({ type: 'error', msg: e.message }) }
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
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f9a825" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
        </svg>
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
                    onDetect={handleDetect} onSave={handleSave} onClassify={handleClassify}
                    status={status} measurements={measurements} classification={classification}
                    selectedMole={selectedMole} onClearSelection={() => setSelectedMole(null)}
                  />
                </>
              )}
            </aside>
            <main className="canvas-area">
              {!image ? (
                <div className="placeholder">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#f9a825" strokeWidth="1">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
                  </svg>
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
  // Recent 10 measurements (most recent first)
  const recent = [...moles].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

  // Group all for summary counts
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
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f9a825" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
          </svg>
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
          <p>Upload a new photo with a penny for scale, label the mole with the brush tool, and get an instant size measurement.</p>
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
              <span>Name</span><span>Date</span><span>Diameter</span><span>Area</span><span></span>
            </div>
            {recent.map(m => {
              const ms = m.measurements || {}
              return (
                <div key={m.id} className="recent-row">
                  <span className="recent-name">{m.name}</span>
                  <span className="recent-date">{m.date}</span>
                  <span className={`recent-diam ${ms.mole_diameter_mm >= 6 ? 'danger' : ms.mole_diameter_mm >= 4 ? 'warn' : 'safe'}`}>
                    {ms.mole_diameter_mm ? `${ms.mole_diameter_mm} mm` : '—'}
                  </span>
                  <span>{ms.mole_area_sq_mm ? `${ms.mole_area_sq_mm} mm\u00B2` : '—'}</span>
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
                <div className="existing-card-header">
                  <span className="existing-name">{name}</span>
                  <span className="existing-count">{entries.length} record{entries.length > 1 ? 's' : ''}</span>
                </div>
                <div className="existing-stats">
                  {ms.mole_diameter_mm && (
                    <span className={ms.mole_diameter_mm >= 6 ? 'danger' : ms.mole_diameter_mm >= 4 ? 'warn' : 'safe'}>
                      {ms.mole_diameter_mm} mm diameter
                    </span>
                  )}
                  {ms.mole_area_sq_mm && <span>{ms.mole_area_sq_mm} mm&sup2;</span>}
                </div>
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
// MOLE FORM
// ═════════════════════════════════════════════════════════════
function MoleForm({ onDetect, onSave, onClassify, status, measurements, classification, selectedMole, onClearSelection }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  useEffect(() => { if (selectedMole) setName(selectedMole.name) }, [selectedMole])

  function diamClass(mm) { return mm >= 6 ? 'danger' : mm >= 4 ? 'warn' : 'safe' }

  const growthInfo = selectedMole && measurements && selectedMole.measurements ? (() => {
    const oldArea = selectedMole.measurements.mole_area_sq_mm, newArea = measurements.mole_area_sq_mm
    if (!oldArea || oldArea === 0) return null
    return { oldArea, newArea, pctChange: Math.round(((newArea - oldArea) / oldArea) * 1000) / 10 }
  })() : null

  return (
    <div className="sidebar-section">
      <h3>{selectedMole ? 'Re-measure Existing Mole' : 'Mole Details'}</h3>
      {selectedMole && (
        <div className="remeasure-banner">
          <div className="remeasure-info">Re-measuring: <strong>{selectedMole.name}</strong>
            <br/><span className="remeasure-prev">Previous: {selectedMole.measurements?.mole_area_sq_mm} mm&sup2; on {selectedMole.date}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClearSelection}>New mole instead</button>
        </div>
      )}
      <div className="field"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Left shoulder mole" /></div>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="field"><label>Notes</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations..." /></div>
      <button className="btn btn-primary" onClick={onDetect}><SearchIcon /> Detect Penny &amp; Measure</button>

      {status.msg && <div className={`status-bar ${status.type}`}>{status.type === 'loading' && <span className="spinner" />}{status.msg}</div>}

      {measurements && (
        <>
          <div className="results-panel">
            <h4>Measurements</h4>
            <div className="result-row"><span className="rlabel">Penny area (px)</span><span className="rvalue">{measurements.penny_pixel_area.toLocaleString()}</span></div>
            <div className="result-row"><span className="rlabel">Mole area (px)</span><span className="rvalue">{measurements.mole_pixel_count.toLocaleString()}</span></div>
            <div className="result-row"><span className="rlabel">Mole area</span><span className="rvalue">{measurements.mole_area_sq_mm} mm&sup2; ({measurements.mole_area_sq_inches} in&sup2;)</span></div>
            <div className="result-row"><span className="rlabel">Mole diameter</span><span className={`rvalue ${diamClass(measurements.mole_diameter_mm)}`}>{measurements.mole_diameter_mm} mm ({measurements.mole_diameter_inches} in)</span></div>
          </div>
          {growthInfo && (
            <div className={`growth-alert ${growthInfo.pctChange >= 20 ? 'growth-danger' : growthInfo.pctChange > 0 ? 'growth-warn' : 'growth-ok'}`}>
              <div className="growth-header">{growthInfo.pctChange >= 20 ? '\u26A0 Significant Growth Detected' : growthInfo.pctChange > 0 ? 'Slight Growth' : 'No Growth / Smaller'}</div>
              <div className="growth-detail">{growthInfo.oldArea} mm&sup2; &rarr; {growthInfo.newArea} mm&sup2; ({growthInfo.pctChange > 0 ? '+' : ''}{growthInfo.pctChange}%)</div>
              {growthInfo.pctChange >= 20 && <div className="growth-warning">This mole has grown more than 20% since last measurement. Please consult a dermatologist.</div>}
            </div>
          )}
          <button className="btn btn-success" style={{ marginTop: 8 }} onClick={() => onSave(name || 'Unnamed', date, notes)}>Save Record</button>
        </>
      )}

      <div className="comparison-tool">
        <h4>Comparison Tool</h4>
        <p className="comparison-desc">Crop the labeled mole and compare it against <strong>2,000+ dermoscopic samples</strong> from the Stanford MIDAS database using AI classification.</p>
        <button className="btn btn-compare" onClick={onClassify}><CompareIcon /> Run Comparison</button>
        {classification && (
          <div className={`classification-result ${classification.label === 'yes' ? 'cls-positive' : 'cls-negative'}`}>
            <div className="cls-header">
              <span className="cls-icon">{classification.label === 'yes' ? '\u26A0' : '\u2713'}</span>
              <span className="cls-verdict">{classification.label === 'yes' ? 'Suspicious' : 'Likely Benign'}</span>
            </div>
            <div className="cls-confidence">Confidence: <strong>{classification.confidence}%</strong></div>
            <div className="cls-label">Model result: <strong>{classification.label === 'yes' ? 'YES' : 'NO'}</strong> &mdash; {classification.label === 'yes' ? 'This mole shares features with potentially malignant samples. Please consult a dermatologist.' : 'This mole appears similar to benign samples. Continue monitoring for changes.'}</div>
            <div className="cls-disclaimer">This is not a medical diagnosis. Always consult a qualified dermatologist for clinical evaluation.</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════
function extractPennyArea(result) {
  if (!result || !Array.isArray(result)) return null
  for (const item of result) {
    console.log('Roboflow item:', JSON.stringify(item, null, 2))
    if (item.area_values && Array.isArray(item.area_values) && item.area_values.length > 0) {
      console.log('area_values found:', item.area_values)
      const area = Math.min(...item.area_values)
      let bbox = null
      for (const key of Object.keys(item)) {
        const val = item[key]
        if (val && typeof val === 'object') {
          const preds = val.predictions || (Array.isArray(val) ? val : null)
          if (Array.isArray(preds)) { for (const p of preds) { if (p.width && p.height) { bbox = { x: p.x, y: p.y, width: p.width, height: p.height, confidence: p.confidence || 0.9 }; break } } }
        }
        if (bbox) break
      }
      return { area, bbox }
    }
    for (const key of Object.keys(item)) {
      const val = item[key]
      if (Array.isArray(val) && val.length > 0 && key.includes('area')) return { area: Math.max(...val), bbox: null }
    }
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
function CompareIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg> }
