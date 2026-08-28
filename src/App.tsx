import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import {
  ArrowUpRight, Box, Check, Circle, Cone, Cylinder, Eraser, Hand, Minus, MousePointer2, Pen,
  RotateCcw, Share2, Square, Triangle, Type, Users, ZoomIn, ZoomOut,
} from 'lucide-react'

type Tool = 'select' | 'pan' | 'pen' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'triangle' | 'cube' | 'cylinder' | 'cone' | 'eraser' | 'text'
type Point = { x: number; y: number }
type Shape = {
  id: string; kind: Exclude<Tool, 'select' | 'pan' | 'eraser'>; points: Point[]
  color: string; width: number; text?: string
}

const colors = ['#1D2735', '#3978C8', '#E45454', '#4CA66A', '#DB8B35', '#9165C1']
const widths = [{ label: 'Thin', value: 2 }, { label: 'Medium', value: 4 }, { label: 'Thick', value: 7 }]
const tools: { id: Tool; label: string; icon: typeof Pen }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 }, { id: 'pan', label: 'Pan canvas', icon: Hand },
  { id: 'pen', label: 'Pen', icon: Pen }, { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Vector arrow', icon: ArrowUpRight }, { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'ellipse', label: 'Circle / ellipse', icon: Circle }, { id: 'triangle', label: 'Triangle', icon: Triangle },
  { id: 'cube', label: '3D cube', icon: Box }, { id: 'cylinder', label: '3D cylinder', icon: Cylinder }, { id: 'cone', label: '3D cone', icon: Cone },
  { id: 'eraser', label: 'Eraser', icon: Eraser }, { id: 'text', label: 'Text label', icon: Type },
]

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const pointToSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}
const pointToEllipse = (point: Point, center: Point, radiusX: number, radiusY: number) => {
  const normalized = Math.hypot((point.x - center.x) / Math.max(radiusX, 1), (point.y - center.y) / Math.max(radiusY, 1))
  return Math.abs(normalized - 1) * Math.min(radiusX, radiusY)
}
const shapeSegments = (shape: Shape): [Point, Point][] => {
  const [start, end = start] = shape.points
  if (shape.kind === 'ellipse') return []
  if (shape.kind === 'triangle') {
    const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x), top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y)
    const apex = { x: (left + right) / 2, y: top }, lowerLeft = { x: left, y: bottom }, lowerRight = { x: right, y: bottom }
    return [[apex, lowerRight], [lowerRight, lowerLeft], [lowerLeft, apex]]
  }
  if (shape.kind === 'rectangle') {
    const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x), top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y)
    const topLeft = { x: left, y: top }, topRight = { x: right, y: top }, bottomLeft = { x: left, y: bottom }, bottomRight = { x: right, y: bottom }
    return [[topLeft, topRight], [topRight, bottomRight], [bottomRight, bottomLeft], [bottomLeft, topLeft]]
  }
  if (shape.kind === 'cube') {
    const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x), top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y)
    const offsetX = Math.max(14, (right - left) * .24), offsetY = Math.max(12, (bottom - top) * .2)
    const backLeft = left + offsetX, backTop = top - offsetY
    const front = [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }]
    const back = [{ x: backLeft, y: backTop }, { x: backLeft + right - left, y: backTop }, { x: backLeft + right - left, y: backTop + bottom - top }, { x: backLeft, y: backTop + bottom - top }]
    return [...[front, back].flatMap(loop => loop.map((point, index) => [point, loop[(index + 1) % 4]] as [Point, Point])), ...front.map((point, index) => [point, back[index]] as [Point, Point])]
  }
  if (shape.kind === 'cylinder') {
    const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x), top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y)
    return [[{ x: left, y: top }, { x: left, y: bottom }], [{ x: right, y: top }, { x: right, y: bottom }], [{ x: left, y: top }, { x: right, y: top }], [{ x: left, y: bottom }, { x: right, y: bottom }]]
  }
  if (shape.kind === 'cone') {
    const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x), top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y)
    return [[{ x: (left + right) / 2, y: top }, { x: left, y: bottom }], [{ x: (left + right) / 2, y: top }, { x: right, y: bottom }], [{ x: left, y: bottom }, { x: right, y: bottom }]]
  }
  return shape.points.slice(1).map((point, index) => [shape.points[index], point])
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 })
  const dragRef = useRef<{ pointerId: number; last: Point; lastScreen?: Point; mode: 'pan' | 'select'; shape?: Shape } | null>(null)
  const previewShapeRef = useRef<Shape | null>(null)
  const drawingRef = useRef<Shape | null>(null)
  const shapesRef = useRef<Shape[]>([])
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(colors[0])
  const [width, setWidth] = useState(4)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [copied, setCopied] = useState(false)
  const [zoomPercent, setZoomPercent] = useState(100)
  const roomIdRef = useRef('')
  const yShapesRef = useRef<Y.Array<Shape> | null>(null)
  shapesRef.current = shapes

  useEffect(() => {
    const roomId = window.location.hash.slice(1) || `room-${makeId()}`
    roomIdRef.current = roomId
    if (!window.location.hash) window.history.replaceState(null, '', `#${roomId}`)
    const doc = new Y.Doc()
    const yShapes = doc.getArray<Shape>('shapes')
    yShapesRef.current = yShapes
    const sync = () => setShapes(yShapes.toArray())
    yShapes.observe(sync)
    sync()
    let provider: WebrtcProvider | null = null
    try {
      const signalingUrl = import.meta.env.VITE_SIGNALING_URL || 'wss://math-board-signaling.onrender.com'
      provider = new WebrtcProvider(`math-board-${roomId}`, doc, {
        signaling: [signalingUrl],
        maxConns: 20,
      })
      provider.on('status', ({ connected }: { connected: boolean }) => setConnected(connected))
      provider.connect()
    } catch {
      setConnected(false)
    }
    return () => { yShapes.unobserve(sync); provider?.destroy(); doc.destroy() }
  }, [])

  const replaceShape = (shape: Shape) => {
    const yShapes = yShapesRef.current
    if (!yShapes) return
    const index = yShapes.toArray().findIndex(item => item.id === shape.id)
    if (index >= 0) yShapes.delete(index, 1), yShapes.insert(index, [shape])
  }
  const addShape = (shape: Shape) => yShapesRef.current?.push([shape])
  const removeShape = (id: string) => {
    const yShapes = yShapesRef.current
    const index = yShapes?.toArray().findIndex(item => item.id === id) ?? -1
    if (yShapes && index >= 0) yShapes.delete(index, 1)
  }
  const screenToWorld = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect(), view = viewportRef.current
    return { x: (event.clientX - rect.left - view.x) / view.zoom, y: (event.clientY - rect.top - view.y) / view.zoom }
  }
  const worldToScreen = (point: Point) => {
    const { x, y, zoom } = viewportRef.current
    return { x: point.x * zoom + x, y: point.y * zoom + y }
  }
  const isShapeHit = (shape: Shape, point: Point) => {
    const tolerance = 14 / viewportRef.current.zoom
    if (shape.kind === 'text') return distance(point, shape.points[0]) < 28 / viewportRef.current.zoom
    const [start, end = start] = shape.points
    const left = Math.min(start.x, end.x) - tolerance
    const right = Math.max(start.x, end.x) + tolerance
    const top = Math.min(start.y, end.y) - tolerance
    const bottom = Math.max(start.y, end.y) + tolerance
    const insideBounds = point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
    if (shape.kind === 'ellipse') {
      const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      const radiusX = Math.max(Math.abs(end.x - start.x) / 2, 1)
      const radiusY = Math.max(Math.abs(end.y - start.y) / 2, 1)
      return pointToEllipse(point, center, radiusX, radiusY) < tolerance || (insideBounds && Math.hypot((point.x - center.x) / radiusX, (point.y - center.y) / radiusY) < 1)
    }
    if (shape.kind === 'rectangle' || shape.kind === 'triangle' || shape.kind === 'cube' || shape.kind === 'cylinder' || shape.kind === 'cone') return insideBounds
    if (insideBounds && shape.points.length > 1) return true
    return shapeSegments(shape).some(([a, b]) => pointToSegment(point, a, b) < tolerance)
  }
  const hitTest = (point: Point) => [...shapesRef.current].reverse().find(shape => isShapeHit(shape, point))
  const eraseAt = (point: Point) => shapesRef.current.filter(shape => isShapeHit(shape, point)).forEach(shape => removeShape(shape.id))

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = screenToWorld(event)
    if (tool === 'pan' || event.button === 1) {
      event.preventDefault()
      dragRef.current = { pointerId: event.pointerId, last: point, lastScreen: { x: event.clientX, y: event.clientY }, mode: 'pan' }
      return
    }
    if (tool === 'text') {
      const text = window.prompt('Add a label or formula')
      if (text?.trim()) addShape({ id: makeId(), kind: 'text', points: [point], color, width, text: text.trim() })
      return
    }
    if (tool === 'select') {
      const hit = hitTest(point); setSelectedId(hit?.id ?? null)
      if (hit) {
        dragRef.current = { pointerId: event.pointerId, last: point, mode: 'select', shape: hit }
        previewShapeRef.current = hit
        draw()
      }
      return
    }
    if (tool === 'eraser') { eraseAt(point); return }
    drawingRef.current = { id: makeId(), kind: tool, points: [point], color, width }
    draw()
  }
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = screenToWorld(event), view = viewportRef.current
    if (tool === 'eraser') { eraseAt(point); return }
    if (dragRef.current?.pointerId === event.pointerId && dragRef.current.mode === 'pan') {
      const previous = dragRef.current.lastScreen || { x: event.clientX, y: event.clientY }
      view.x += event.clientX - previous.x; view.y += event.clientY - previous.y
      dragRef.current.lastScreen = { x: event.clientX, y: event.clientY }
      draw(); return
    }
    if (dragRef.current?.pointerId === event.pointerId && dragRef.current.shape && dragRef.current.mode === 'select') {
      const dx = point.x - dragRef.current.last.x, dy = point.y - dragRef.current.last.y
      const moved = { ...dragRef.current.shape, points: dragRef.current.shape.points.map(item => ({ x: item.x + dx, y: item.y + dy })) }
      dragRef.current.shape = moved; dragRef.current.last = point; previewShapeRef.current = moved
      draw()
      return
    }
    if (drawingRef.current) {
      const shape = drawingRef.current
      if (shape.kind === 'pen') shape.points.push(point); else shape.points = [shape.points[0], point]
      draw()
    }
  }
  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId && dragRef.current.shape && dragRef.current.mode === 'select') {
      const finalShape = dragRef.current.shape
      shapesRef.current = shapesRef.current.map(shape => shape.id === finalShape.id ? finalShape : shape)
      setShapes([...shapesRef.current])
      replaceShape(finalShape)
    }
    if (drawingRef.current) addShape(drawingRef.current)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    drawingRef.current = null; dragRef.current = null; previewShapeRef.current = null; requestDraw()
  }
  const zoomAt = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect(), view = viewportRef.current
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top }, before = { x: (anchor.x - view.x) / view.zoom, y: (anchor.y - view.y) / view.zoom }
    view.zoom = Math.min(3.5, Math.max(0.35, view.zoom * (event.deltaY > 0 ? 0.92 : 1.08)))
    view.x = anchor.x - before.x * view.zoom; view.y = anchor.y - before.y * view.zoom; setZoomPercent(Math.round(view.zoom * 100)); draw()
  }

  const drawShape = (context: CanvasRenderingContext2D, shape: Shape) => {
    const points = shape.points.map(worldToScreen); if (!points.length) return
    context.strokeStyle = shape.color; context.fillStyle = shape.color; context.lineWidth = shape.width * viewportRef.current.zoom
    context.lineCap = 'round'; context.lineJoin = 'round'; context.beginPath()
    if (shape.kind === 'text') { context.font = `${Math.max(14, 16 * viewportRef.current.zoom)}px "DM Sans", sans-serif`; context.fillText(shape.text || '', points[0].x, points[0].y); return }
    if (shape.kind === 'pen' || shape.kind === 'line' || shape.kind === 'arrow') {
      context.moveTo(points[0].x, points[0].y)
      if (shape.kind === 'pen' && points.length > 2) {
        for (let index = 1; index < points.length - 1; index += 1) {
          const midpoint = { x: (points[index].x + points[index + 1].x) / 2, y: (points[index].y + points[index + 1].y) / 2 }
          context.quadraticCurveTo(points[index].x, points[index].y, midpoint.x, midpoint.y)
        }
        const last = points[points.length - 1], previous = points[points.length - 2]
        context.quadraticCurveTo(previous.x, previous.y, last.x, last.y)
      } else points.slice(1).forEach(point => context.lineTo(point.x, point.y))
      context.stroke()
      if (shape.kind === 'arrow' && points.length > 1) { const end = points[points.length - 1], start = points[points.length - 2]; const angle = Math.atan2(end.y - start.y, end.x - start.x); context.beginPath(); context.moveTo(end.x, end.y); context.lineTo(end.x - 13 * Math.cos(angle - Math.PI / 6), end.y - 13 * Math.sin(angle - Math.PI / 6)); context.moveTo(end.x, end.y); context.lineTo(end.x - 13 * Math.cos(angle + Math.PI / 6), end.y - 13 * Math.sin(angle + Math.PI / 6)); context.stroke() }
    } else {
      const start = points[0], end = points[1] || start, left = Math.min(start.x, end.x), top = Math.min(start.y, end.y), w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y)
      if (shape.kind === 'rectangle') context.strokeRect(left, top, w, h)
      if (shape.kind === 'ellipse') context.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2), context.stroke()
      if (shape.kind === 'triangle') { context.moveTo(left + w / 2, top); context.lineTo(left + w, top + h); context.lineTo(left, top + h); context.closePath(); context.stroke() }
      if (shape.kind === 'cube') {
        const offsetX = Math.max(14, w * .24), offsetY = Math.max(12, h * .2)
        const backLeft = left + offsetX, backTop = top - offsetY
        context.strokeRect(left, top, w, h)
        context.strokeRect(backLeft, backTop, w, h)
        context.beginPath()
        context.moveTo(left, top); context.lineTo(backLeft, backTop)
        context.moveTo(left + w, top); context.lineTo(backLeft + w, backTop)
        context.moveTo(left, top + h); context.lineTo(backLeft, backTop + h)
        context.moveTo(left + w, top + h); context.lineTo(backLeft + w, backTop + h)
        context.stroke()
      }
      if (shape.kind === 'cylinder') {
        const radiusX = Math.max(12, w / 2), radiusY = Math.max(5, Math.min(18, radiusX * .28)), centerX = left + w / 2
        context.beginPath(); context.ellipse(centerX, top + radiusY, radiusX, radiusY, 0, 0, Math.PI * 2); context.stroke()
        context.beginPath(); context.moveTo(left, top + radiusY); context.lineTo(left, top + h - radiusY); context.ellipse(centerX, top + h - radiusY, radiusX, radiusY, 0, 0, Math.PI); context.moveTo(left + w, top + radiusY); context.lineTo(left + w, top + h - radiusY); context.stroke()
      }
      if (shape.kind === 'cone') {
        const centerX = left + w / 2, baseY = top + h, radiusX = Math.max(12, w / 2), radiusY = Math.max(5, Math.min(18, radiusX * .28))
        context.beginPath(); context.moveTo(centerX, top); context.lineTo(left, baseY - radiusY); context.ellipse(centerX, baseY - radiusY, radiusX, radiusY, 0, 0, Math.PI); context.moveTo(centerX, top); context.lineTo(left + w, baseY - radiusY); context.ellipse(centerX, baseY - radiusY, radiusX, radiusY, 0, Math.PI, Math.PI * 2); context.stroke()
      }
    }
    if (shape.id === selectedId) { const bounds = shape.points.map(worldToScreen), minX = Math.min(...bounds.map(p => p.x)) - 8, minY = Math.min(...bounds.map(p => p.y)) - 8, maxX = Math.max(...bounds.map(p => p.x)) + 8, maxY = Math.max(...bounds.map(p => p.y)) + 8; context.setLineDash([4, 4]); context.strokeStyle = '#3978C8'; context.lineWidth = 1; context.strokeRect(minX, minY, maxX - minX, maxY - minY); context.setLineDash([]) }
  }
  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const context = canvas.getContext('2d'); if (!context) return
    const ratio = window.devicePixelRatio || 1, widthPx = canvas.clientWidth, heightPx = canvas.clientHeight
    if (canvas.width !== widthPx * ratio || canvas.height !== heightPx * ratio) { canvas.width = widthPx * ratio; canvas.height = heightPx * ratio }
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, widthPx, heightPx); context.fillStyle = '#F7F9FD'; context.fillRect(0, 0, widthPx, heightPx)
    const view = viewportRef.current, cell = 25 * view.zoom, ox = ((view.x % cell) + cell) % cell, oy = ((view.y % cell) + cell) % cell
    context.strokeStyle = '#D1E3F8'; context.lineWidth = 1; context.beginPath()
    for (let x = ox; x < widthPx; x += cell) context.moveTo(x, 0), context.lineTo(x, heightPx)
    for (let y = oy; y < heightPx; y += cell) context.moveTo(0, y), context.lineTo(widthPx, y)
    context.stroke()
    const majorCell = cell * 5, majorOx = ((view.x % majorCell) + majorCell) % majorCell, majorOy = ((view.y % majorCell) + majorCell) % majorCell
    context.strokeStyle = '#B8D0EF'; context.beginPath()
    for (let x = majorOx; x < widthPx; x += majorCell) context.moveTo(x, 0), context.lineTo(x, heightPx)
    for (let y = majorOy; y < heightPx; y += majorCell) context.moveTo(0, y), context.lineTo(widthPx, y)
    context.stroke()
    const axisX = view.x, axisY = view.y
    context.strokeStyle = '#9CBCE3'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(axisX, 0); context.lineTo(axisX, heightPx); context.moveTo(0, axisY); context.lineTo(widthPx, axisY); context.stroke()
    const draggedShape = previewShapeRef.current
    shapesRef.current.forEach(shape => drawShape(context, shape.id === draggedShape?.id ? draggedShape : shape)); if (drawingRef.current) drawShape(context, drawingRef.current)
  }
  const requestDraw = () => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => { frameRef.current = null; draw() })
  }
  useEffect(() => {
    draw()
    requestDraw()
    const resize = () => requestDraw()
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current) }
  }, [shapes, selectedId])
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'v') setTool('select'); if (event.key === 'h') setTool('pan'); if (event.key === 'p') setTool('pen'); if (event.key === 'e') setTool('eraser'); if (event.key === 'Delete' && selectedId) removeShape(selectedId) }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [selectedId])
  const share = async () => { await navigator.clipboard?.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark"><span>m</span><strong>Math Board</strong></div><div className="room-meta"><span className="room-name">Algebra room</span><span className={`connection ${connected ? 'online' : ''}`}><i />{connected ? 'Connected' : 'Connecting'}</span><span className="participant-count"><Users size={14} /> {shapes.length ? '2' : '1'}</span></div><button className="share-button" onClick={share}>{copied ? <Check size={16} /> : <Share2 size={16} />}{copied ? 'Copied' : 'Share link'}</button></header>
    <aside className="tool-rail">{tools.map(({ id, label, icon: Icon }, index) => <span key={id} className={index === 2 || index === 5 || index === 8 ? 'tool-divider' : ''}><button aria-label={label} title={label} className={`tool-button ${tool === id ? 'active' : ''}`} onClick={() => setTool(id)}><Icon size={19} strokeWidth={1.8} /></button></span>)}</aside>
    <canvas ref={canvasRef} className={`whiteboard-canvas cursor-${tool}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={zoomAt} />
    <div className="zoom-control"><button title="Zoom out" aria-label="Zoom out" onClick={() => { viewportRef.current.zoom = Math.max(.35, viewportRef.current.zoom - .1); setZoomPercent(Math.round(viewportRef.current.zoom * 100)); draw() }}><ZoomOut size={16} /></button><span>{zoomPercent}%</span><button title="Zoom in" aria-label="Zoom in" onClick={() => { viewportRef.current.zoom = Math.min(3.5, viewportRef.current.zoom + .1); setZoomPercent(Math.round(viewportRef.current.zoom * 100)); draw() }}><ZoomIn size={16} /></button><button title="Reset view" aria-label="Reset view" onClick={() => { viewportRef.current = { x: 0, y: 0, zoom: 1 }; setZoomPercent(100); draw() }}><RotateCcw size={15} /></button></div>
    <section className="property-bar"><div className="property-group"><span className="property-label">Ink</span>{colors.map(item => <button key={item} aria-label={`Use ${item} ink`} className={`swatch ${color === item ? 'selected' : ''}`} style={{ backgroundColor: item }} onClick={() => setColor(item)} />)}</div><div className="property-separator" /><div className="property-group"><span className="property-label">Stroke</span>{widths.map(item => <button key={item.value} className={`width-button width-${item.value} ${width === item.value ? 'selected' : ''}`} onClick={() => setWidth(item.value)} title={item.label}><span /></button>)}</div><div className="status-hint">{tool === 'select' ? 'Select and move objects' : tools.find(item => item.id === tool)?.label}</div></section>
  </main>
}

export default App