import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from './api'

/* ---------- Types ---------- */
export type LayerType = 'text' | 'rect' | 'ellipse' | 'avatar' | 'image'
export type Layer = {
  id: string; type: LayerType
  x: number; y: number; w: number; h: number
  fill: string; stroke: string; strokeW: number; radius: number; opacity: number
  text: string; size: number; align: 'left' | 'center' | 'right'; bold: boolean; url: string
}
export type Bg = { type: 'color' | 'gradient' | 'image'; c1: string; c2: string; angle: number; url: string; dim: number }
export type Design = { w: number; h: number; bg: Bg; layers: Layer[] }

/** A setting is shown with the designer when its type is "design" or its key ends with "_design". */
export const isDesign = (s: any) => s.type == 'design' || /_design$/.test(s.key)

const MAX_LAYERS = 40
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (n: any, lo: number, hi: number, d: number) => { n = Number(n); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

const mk = (type: LayerType, o: Partial<Layer> = {}): Layer => ({
  id: uid(), type, x: 100, y: 100, w: 200, h: 100, fill: '#ffffff', stroke: '#ffffff', strokeW: 0, radius: 0, opacity: 1,
  text: 'Text', size: 48, align: 'center', bold: true, url: '', ...o,
})
const T = (text: string, x: number, y: number, w: number, h: number, size: number, fill: string, o: Partial<Layer> = {}) =>
  mk('text', { text, x, y, w, h, size, fill, ...o })

/* Keep "Classic" identical to DEFAULT_DESIGN in welcome.py */
export const TEMPLATES: Record<string, () => Design> = {
  Classic: () => ({
    w: 1024, h: 450,
    bg: { type: 'gradient', c1: '#0f2027', c2: '#2c5364', angle: 35, url: '', dim: 0 },
    layers: [
      mk('rect', { x: 40, y: 40, w: 944, h: 370, fill: '#000000', opacity: .35, radius: 28, stroke: '#8ad4ff', strokeW: 3 }),
      mk('avatar', { x: 417, y: 55, w: 190, h: 190, radius: 95, stroke: '#ffffff', strokeW: 6 }),
      T('WELCOME', 112, 255, 800, 66, 58, '#ffffff'),
      T('{user}', 112, 322, 800, 50, 38, '#8ad4ff'),
      T('You are member #{count}', 112, 368, 800, 34, 22, '#c6dcf0', { bold: false }),
    ],
  }),
  Neon: () => ({
    w: 1024, h: 450,
    bg: { type: 'gradient', c1: '#12002b', c2: '#00172e', angle: 120, url: '', dim: 0 },
    layers: [
      mk('rect', { x: 30, y: 30, w: 964, h: 390, fill: '#000000', opacity: 0, radius: 24, stroke: '#ff4fd8', strokeW: 4 }),
      mk('avatar', { x: 70, y: 100, w: 250, h: 250, radius: 125, stroke: '#00e5ff', strokeW: 6 }),
      T('WELCOME', 360, 120, 600, 90, 80, '#ffffff', { align: 'left' }),
      T('{user}', 360, 215, 600, 70, 52, '#00e5ff', { align: 'left' }),
      T('You are member #{count}', 360, 295, 600, 40, 26, '#ff9fd6', { align: 'left', bold: false }),
    ],
  }),
  Minimal: () => ({
    w: 1024, h: 450,
    bg: { type: 'color', c1: '#f5f7fb', c2: '#ffffff', angle: 0, url: '', dim: 0 },
    layers: [
      mk('rect', { x: 0, y: 0, w: 24, h: 450, fill: '#3aa3ff' }),
      mk('avatar', { x: 70, y: 100, w: 250, h: 250, radius: 40 }),
      T('Welcome', 360, 130, 620, 80, 70, '#1b2a4a', { align: 'left' }),
      T('{user}', 360, 215, 620, 60, 46, '#3aa3ff', { align: 'left' }),
      T('to {server}', 360, 285, 620, 40, 30, '#5a7396', { align: 'left', bold: false }),
    ],
  }),
}

export function parse(v: any): Design {
  try {
    const o = typeof v == 'string' && v.trim() ? JSON.parse(v) : v
    if (o && Array.isArray(o.layers) && o.bg) {
      return {
        w: clamp(o.w, 200, 1920, 1024), h: clamp(o.h, 100, 1080, 450),
        bg: { ...TEMPLATES.Classic().bg, ...o.bg },
        layers: o.layers.slice(0, MAX_LAYERS).map((l: any) => ({ ...mk(l.type || 'text'), ...l, id: l.id || uid() })),
      }
    }
  } catch { /* fall through */ }
  return TEMPLATES.Classic()
}

/* ---------- Drawing (preview) ---------- */
type Ent = { el: HTMLImageElement; ok: boolean; subs: Set<() => void> }
const IMGS = new Map<string, Ent>()
function getImg(url: string, cb: () => void) {
  let e = IMGS.get(url)
  if (!e) {
    const ent: Ent = { el: new Image(), ok: false, subs: new Set() }
    ent.el.onload = () => { ent.ok = true; ent.subs.forEach(f => f()) }
    ent.el.src = url
    IMGS.set(url, ent); e = ent
  }
  if (e.ok) return e.el
  e.subs.add(cb)
  return null
}

const SC = document.createElement('canvas')
const scratch = (w: number, h: number) => { SC.width = w; SC.height = h; return SC.getContext('2d')! }

const SAMPLE: Record<string, string> = { user: 'NewMember', name: 'NewMember', server: 'My Server', count: '128' }
const sub = (t: string) => t.replace(/\{(user|name|server|count)\}/g, (_, k) => SAMPLE[k])

function roundPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  c.beginPath(); c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath()
}

function cover(c: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / im.naturalWidth, h / im.naturalHeight)
  const sw = w / k, sh = h / k
  c.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

function drawText(c: CanvasRenderingContext2D, l: Layer) {
  const lines = sub(l.text).split('\n').slice(0, 6)
  const font = (s: number) => `${l.bold ? 800 : 500} ${s}px Manrope, system-ui, sans-serif`
  let size = l.size
  for (; size > 10; size--) {
    c.font = font(size)
    if (Math.max(...lines.map(s => c.measureText(s).width)) <= l.w) break
  }
  c.font = font(size); c.fillStyle = l.fill; c.textBaseline = 'middle'; c.textAlign = l.align
  const lh = size * 1.2, top = l.y + (l.h - lh * lines.length) / 2
  const x = l.align == 'left' ? l.x : l.align == 'right' ? l.x + l.w : l.x + l.w / 2
  lines.forEach((s, i) => c.fillText(s, x, top + lh * (i + .5)))
}

function drawLayer(c: CanvasRenderingContext2D, l: Layer, redraw: () => void) {
  const { x, y, w, h } = l, sw = l.strokeW
  if (l.type == 'text') return drawText(c, l)
  if (l.type == 'rect' || l.type == 'ellipse') {
    const path = (px: number, py: number, pw: number, ph: number, shrink: number) => {
      if (l.type == 'ellipse') { c.beginPath(); c.ellipse(px + pw / 2, py + ph / 2, Math.max(0, pw / 2), Math.max(0, ph / 2), 0, 0, Math.PI * 2) }
      else roundPath(c, px, py, pw, ph, l.radius - shrink)
    }
    path(x, y, w, h, 0); c.fillStyle = l.fill; c.fill()
    if (sw) { path(x + sw / 2, y + sw / 2, w - sw, h - sw, sw / 2); c.lineWidth = sw; c.strokeStyle = l.stroke; c.stroke() }
    return
  }
  // avatar / image
  c.save(); roundPath(c, x, y, w, h, l.radius); c.clip()
  const im = l.type == 'image' && l.url ? getImg(l.url, redraw) : null
  if (im) cover(c, im, x, y, w, h)
  else {
    c.fillStyle = l.type == 'avatar' ? '#5a698c' : '#2a3550'; c.fillRect(x, y, w, h)
    if (l.type == 'avatar') {
      c.fillStyle = 'rgba(255,255,255,.55)'
      c.beginPath(); c.arc(x + w / 2, y + h * .38, h * .18, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.ellipse(x + w / 2, y + h * .95, w * .34, h * .34, 0, 0, Math.PI * 2); c.fill()
    }
  }
  c.restore()
  if (sw) { roundPath(c, x + sw / 2, y + sw / 2, w - sw, h - sw, l.radius - sw / 2); c.lineWidth = sw; c.strokeStyle = l.stroke; c.stroke() }
}

export function paint(c: CanvasRenderingContext2D, d: Design, redraw: () => void) {
  const { w, h, bg } = d
  c.clearRect(0, 0, w, h)
  if (bg.type == 'gradient') {
    const a = bg.angle * Math.PI / 180, cx = Math.cos(a), cy = Math.sin(a)
    const L = (Math.abs(w * cx) + Math.abs(h * cy)) / 2
    const g = c.createLinearGradient(w / 2 - cx * L, h / 2 - cy * L, w / 2 + cx * L, h / 2 + cy * L)
    g.addColorStop(0, bg.c1); g.addColorStop(1, bg.c2); c.fillStyle = g
  } else c.fillStyle = bg.c1
  c.fillRect(0, 0, w, h)
  if (bg.type == 'image' && bg.url) { const im = getImg(bg.url, redraw); if (im) cover(c, im, 0, 0, w, h) }
  if (bg.dim > 0) { c.fillStyle = `rgba(0,0,0,${bg.dim / 100})`; c.fillRect(0, 0, w, h) }
  for (const l of d.layers) {
    if (l.opacity >= 1) drawLayer(c, l, redraw)
    else {
      const s = scratch(w, h); drawLayer(s, l, redraw)
      c.save(); c.globalAlpha = Math.max(0, l.opacity); c.drawImage(SC, 0, 0); c.restore()
    }
  }
}

/* ---------- Canvas (preview + drag/resize) ---------- */
type Drag = { id: string; mode: 'move' | 'size'; px: number; py: number; o: Layer }

function DesignCanvas({ d, sel, onSel, onPatch, style }: {
  d: Design; sel?: string | null; onSel?: (id: string | null) => void
  onPatch?: (id: string, p: Partial<Layer>) => void; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Drag | null>(null)
  const [t, setT] = useState(0)
  const redraw = useCallback(() => setT(x => x + 1), [])

  useEffect(() => {
    const cv = ref.current!; cv.width = d.w; cv.height = d.h
    const c = cv.getContext('2d')!; paint(c, d, redraw)
    const s = onSel && sel ? d.layers.find(l => l.id == sel) : null
    if (s) {
      const k = d.w / (cv.clientWidth || d.w)
      c.save(); c.strokeStyle = '#38b6ff'; c.lineWidth = 2 * k; c.setLineDash([8 * k, 5 * k]); c.strokeRect(s.x, s.y, s.w, s.h); c.setLineDash([])
      const z = 12 * k; c.fillStyle = '#38b6ff'; c.fillRect(s.x + s.w - z / 2, s.y + s.h - z / 2, z, z); c.restore()
    }
  }, [d, sel, t, redraw, onSel])

  const pt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) * d.w / r.width, y: (e.clientY - r.top) * d.h / r.height, k: d.w / r.width }
  }
  const down = (e: React.PointerEvent) => {
    if (!onSel) return
    const p = pt(e), s = d.layers.find(l => l.id == sel)
    if (s && Math.abs(p.x - (s.x + s.w)) < 14 * p.k && Math.abs(p.y - (s.y + s.h)) < 14 * p.k) {
      drag.current = { id: s.id, mode: 'size', px: p.x, py: p.y, o: s }
    } else {
      const hit = [...d.layers].reverse().find(l => p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h)
      onSel(hit?.id ?? null)
      drag.current = hit ? { id: hit.id, mode: 'move', px: p.x, py: p.y, o: hit } : null
    }
    ref.current!.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const g = drag.current; if (!g || !onPatch) return
    const p = pt(e), dx = p.x - g.px, dy = p.y - g.py
    onPatch(g.id, g.mode == 'move'
      ? { x: Math.round(g.o.x + dx), y: Math.round(g.o.y + dy) }
      : { w: Math.max(10, Math.round(g.o.w + dx)), h: Math.max(10, Math.round(g.o.h + dy)) })
  }
  return <canvas ref={ref} style={style} onPointerDown={down} onPointerMove={move}
    onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} />
}

/* ---------- Small form helpers (module scope so inputs keep focus) ---------- */
const Num = ({ label, v, on, min, max }: { label: string; v: number; on: (n: number) => void; min?: number; max?: number }) =>
  <label className="f"><span>{label}</span>
    <input type="number" min={min} max={max} value={Number.isFinite(v) ? v : 0} onChange={e => on(+e.target.value || 0)} /></label>
const Col = ({ label, v, on }: { label: string; v: string; on: (s: string) => void }) =>
  <label className="f"><span>{label}</span><input type="color" value={v} onChange={e => on(e.target.value)} /></label>
const Url = ({ label, v, on }: { label: string; v: string; on: (s: string) => void }) =>
  <label className="f"><span>{label}</span><input placeholder="https://..." value={v} onChange={e => on(e.target.value.trim())} /></label>

const NAMES: Record<LayerType, string> = { text: 'Text', rect: 'Rectangle', ellipse: 'Circle', avatar: 'Avatar', image: 'Image' }
const layerName = (l: Layer) => l.type == 'text' ? 'Text: ' + (l.text.replace(/\s+/g, ' ').slice(0, 22) || '(empty)') : NAMES[l.type]

function LayerProps({ l, up }: { l: Layer; up: (p: Partial<Layer>) => void }) {
  const pic = l.type == 'avatar' || l.type == 'image'
  return <>
    <h3>{NAMES[l.type]}</h3>
    {l.type == 'text' && <>
      <label className="f"><span>Text · use {'{user} {name} {server} {count}'}</span>
        <textarea rows={3} value={l.text} onChange={e => up({ text: e.target.value })} /></label>
      <div className="fg">
        <Num label="Size" v={l.size} on={size => up({ size })} min={6} max={400} />
        <label className="f"><span>Align</span>
          <select value={l.align} onChange={e => up({ align: e.target.value as Layer['align'] })}>
            <option value="left">left</option><option value="center">center</option><option value="right">right</option></select></label>
      </div>
      <label className="f chk"><span>Bold</span><input type="checkbox" checked={l.bold} onChange={e => up({ bold: e.target.checked })} /></label>
    </>}
    {l.type == 'image' && <Url label="Image URL (direct https link)" v={l.url} on={url => up({ url })} />}
    {!pic && <Col label={l.type == 'text' ? 'Text color' : 'Fill color'} v={l.fill} on={fill => up({ fill })} />}
    {l.type != 'text' && <div className="fg">
      <Col label="Border color" v={l.stroke} on={stroke => up({ stroke })} />
      <Num label="Border width" v={l.strokeW} on={strokeW => up({ strokeW })} min={0} max={100} />
    </div>}
    {(l.type == 'rect' || pic) && <div className="fg">
      <Num label="Corner radius" v={l.radius} on={radius => up({ radius })} min={0} max={2000} />
      {pic && <label className="f"><span>&nbsp;</span>
        <button className="s" onClick={() => up({ radius: Math.round(Math.min(l.w, l.h) / 2) })}>Make circle</button></label>}
    </div>}
    <Num label="Opacity %" v={Math.round(l.opacity * 100)} on={n => up({ opacity: clamp(n, 0, 100, 100) / 100 })} min={0} max={100} />
    <h3>Position &amp; size</h3>
    <div className="fg">
      <Num label="X" v={l.x} on={x => up({ x })} /><Num label="Y" v={l.y} on={y => up({ y })} />
      <Num label="Width" v={l.w} on={w => up({ w: Math.max(1, w) })} /><Num label="Height" v={l.h} on={h => up({ h: Math.max(1, h) })} />
    </div>
  </>
}

const SIZES = ['1024x450', '1200x500', '800x300', '1280x720', '600x600']

function BgProps({ d, set }: { d: Design; set: (f: (d: Design) => Design) => void }) {
  const b = d.bg, sb = (p: Partial<Bg>) => set(x => ({ ...x, bg: { ...x.bg, ...p } }))
  const cur = `${d.w}x${d.h}`
  return <>
    <h3>Image size</h3>
    <label className="f"><span>Canvas</span>
      <select value={cur} onChange={e => { const [w, h] = e.target.value.split('x').map(Number); set(x => ({ ...x, w, h })) }}>
        {(SIZES.includes(cur) ? SIZES : [cur, ...SIZES]).map(s => <option key={s}>{s}</option>)}</select></label>
    <h3>Background</h3>
    <label className="f"><span>Type</span>
      <select value={b.type} onChange={e => sb({ type: e.target.value as Bg['type'] })}>
        <option value="color">Solid color</option><option value="gradient">Gradient</option><option value="image">Image</option></select></label>
    <Col label={b.type == 'gradient' ? 'Color 1' : 'Color'} v={b.c1} on={c1 => sb({ c1 })} />
    {b.type == 'gradient' && <div className="fg">
      <Col label="Color 2" v={b.c2} on={c2 => sb({ c2 })} />
      <Num label="Angle °" v={b.angle} on={angle => sb({ angle })} min={-360} max={360} />
    </div>}
    {b.type == 'image' && <>
      <Url label="Background image URL (direct https link)" v={b.url} on={url => sb({ url })} />
      <Num label="Darken %" v={b.dim} on={n => sb({ dim: clamp(n, 0, 100, 0) })} min={0} max={100} />
    </>}
    <p className="dim" style={{ fontSize: 12.5 }}>Select a layer on the canvas or in the list to edit it. Click empty space to come back here.</p>
  </>
}

/* ---------- Editor modal ---------- */
function Editor({ value, onSave, onClose }: { value: string; onSave: (json: string) => Promise<void>; onClose: () => void }) {
  const initial = useRef(JSON.stringify(parse(value)))
  const [d, setD] = useState<Design>(() => parse(value))
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(d) != initial.current

  useEffect(() => {
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = o }
  }, [])

  const up = useCallback((id: string, p: Partial<Layer>) => setD(x => ({ ...x, layers: x.layers.map(l => l.id == id ? { ...l, ...p } : l) })), [])
  const cur = d.layers.find(l => l.id == sel)

  const add = (type: LayerType) => {
    if (d.layers.length >= MAX_LAYERS) return toast(`Max ${MAX_LAYERS} layers`)
    const cx = d.w / 2, cy = d.h / 2
    const l = type == 'text' ? mk('text', { text: 'New text', x: cx - 200, y: cy - 40, w: 400, h: 80 })
      : type == 'rect' ? mk('rect', { x: cx - 120, y: cy - 60, w: 240, h: 120, fill: '#3aa3ff', radius: 16 })
      : type == 'ellipse' ? mk('ellipse', { x: cx - 80, y: cy - 80, w: 160, h: 160, fill: '#ff9fd6' })
      : type == 'avatar' ? mk('avatar', { x: cx - 80, y: cy - 80, w: 160, h: 160, radius: 80, stroke: '#ffffff', strokeW: 5 })
      : mk('image', { x: cx - 100, y: cy - 100, w: 200, h: 200 })
    setD(x => ({ ...x, layers: [...x.layers, l] })); setSel(l.id)
  }
  const dup = (id: string) => {
    if (d.layers.length >= MAX_LAYERS) return toast(`Max ${MAX_LAYERS} layers`)
    const l = d.layers.find(x => x.id == id); if (!l) return
    const n = { ...l, id: uid(), x: l.x + 20, y: l.y + 20 }
    setD(x => ({ ...x, layers: [...x.layers, n] })); setSel(n.id)
  }
  const del = (id: string) => { setD(x => ({ ...x, layers: x.layers.filter(l => l.id != id) })); if (sel == id) setSel(null) }
  const order = (id: string, dir: 1 | -1) => setD(x => {
    const i = x.layers.findIndex(l => l.id == id), j = i + dir
    if (i < 0 || j < 0 || j >= x.layers.length) return x
    const a = [...x.layers];[a[i], a[j]] = [a[j], a[i]]
    return { ...x, layers: a }
  })

  const close = () => { if (!dirty || confirm('Discard your changes?')) onClose() }
  const tpl = (k: string) => {
    if (!k || !TEMPLATES[k]) return
    if (dirty && !confirm('Replace the current design with this template?')) return
    setD(TEMPLATES[k]()); setSel(null)
  }
  const save = async () => {
    setBusy(true)
    try { await onSave(JSON.stringify(d)); onClose() } catch { setBusy(false) }
  }

  return (
    <div id="dz" role="dialog" aria-modal="true" aria-label="Welcome image designer">
      <div className="dz">
        <div className="dz-top">
          <h4>Welcome image designer</h4>
          <select aria-label="Template" value="" onChange={e => tpl(e.target.value)}>
            <option value="">Templates…</option>{Object.keys(TEMPLATES).map(k => <option key={k}>{k}</option>)}</select>
          <button onClick={close}>Cancel</button>
          <button className="p" disabled={busy} onClick={save}>Save design</button>
        </div>
        <div className="dz-body">
          <div className="dz-main">
            <div className="dz-tools">
              {(Object.keys(NAMES) as LayerType[]).map(t => <button key={t} className="s" onClick={() => add(t)}>+ {NAMES[t]}</button>)}
            </div>
            <div className="dz-stage">
              <DesignCanvas d={d} sel={sel} onSel={setSel} onPatch={up} style={{ width: `min(100%, ${55 * d.w / d.h}vh)` }} />
            </div>
            <p className="dim" style={{ margin: '8px 2px', fontSize: 12.5 }}>
              Drag to move · drag the square corner to resize · preview uses sample data (NewMember, My Server, #128).
              Fonts and text width may differ slightly in the final image.
            </p>
            <h3>Layers</h3>
            {!d.layers.length && <span className="empty">No layers yet. Add some above.</span>}
            {[...d.layers].reverse().map(l => (
              <div key={l.id} className={'dz-ly' + (l.id == sel ? ' on' : '')} onClick={() => setSel(l.id)}>
                <span>{layerName(l)}</span>
                <button className="s" title="Bring forward" onClick={e => { e.stopPropagation(); order(l.id, 1) }}>▲</button>
                <button className="s" title="Send backward" onClick={e => { e.stopPropagation(); order(l.id, -1) }}>▼</button>
                <button className="s" title="Duplicate" onClick={e => { e.stopPropagation(); dup(l.id) }}>⧉</button>
                <button className="s d" title="Delete" onClick={e => { e.stopPropagation(); del(l.id) }}>✕</button>
              </div>
            ))}
          </div>
          <div className="dz-side">
            {cur ? <LayerProps l={cur} up={p => up(cur.id, p)} /> : <BgProps d={d} set={f => setD(f)} />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Field used inside the cog settings ---------- */
export function DesignField({ value, onSave }: { value: string; onSave: (json: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const d = useMemo(() => parse(value), [value])
  return (
    <span className="dzf">
      <DesignCanvas d={d} />
      <button className="p" onClick={() => setOpen(true)}>Open designer</button>
      {open && createPortal(<Editor value={value} onSave={onSave} onClose={() => setOpen(false)} />, document.body)}
    </span>
  )
}
